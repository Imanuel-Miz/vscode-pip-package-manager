import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as cp from 'child_process';
import axios from 'axios';
import * as treeItems from '../treeView/TreeItems'
import * as cliCommands from './cliCommands'
import * as logUtils from './logUtils'
const extensionConfig = vscode.workspace.getConfiguration('pipPackageManager')
const followSymbolicLinks: boolean = extensionConfig.get('followSymbolicLinks')

export function updateConfiguration(configSetting: string, configValue: any) {
  logUtils.sendOutputLogToChannel(`About to update config setting: ${configSetting}, with value: ${configValue}`, logUtils.logType.INFO)
  extensionConfig.update(configSetting, configValue, vscode.ConfigurationTarget.Workspace)
}

function checkFolderForPyFiles(folderPath: string): boolean {
  const pythonFiles = glob.sync(`${folderPath}/**/*.py`);
  return pythonFiles.length > 0;
}

export function enrichInfoFromPythonExtension(folderViews: treeItems.FoldersView[], pythonExtensionConfig: vscode.Extension<any>) {
  folderViews.forEach((folderView) => {
    for (let key in pythonExtensionConfig.exports.environments["known"]) {
      let env_info = pythonExtensionConfig.exports.environments["known"][key];
      try {
        if (env_info["internal"]["environment"]["workspaceFolder"]["name"] === folderView.folderName) {
          folderView.folderVenv = env_info["internal"]["path"]
        }
      } catch (error) {
        continue
      }
    }
  })
  folderViews.forEach((folderView) => {
    if (!folderView.folderVenv) {
      logUtils.sendOutputLogToChannel(`Unable to find Python interpreter for workspace: ${folderView.folderName}`, logUtils.logType.WARNING)
      vscode.window.showWarningMessage(`Unable to find Python interpreter for workspace: ${folderView.folderName}, please attach a Python interpreter manually`)
    }
  })
}

export function getWorkspaceFoldersOnly(folderViews: treeItems.FoldersView[]) {
  vscode.workspace.workspaceFolders!.forEach((folder) => {
    let folderHasPythonFiles = checkFolderForPyFiles(folder.uri.fsPath)
    if (folderHasPythonFiles) {
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(folder.uri);
      let folderView = new treeItems.FoldersView(
        workspaceFolder.name,
        null,
        folder.uri.fsPath,
        vscode.TreeItemCollapsibleState.Collapsed
      );
      folderViews.push(folderView);
    }
    else {
      logUtils.sendOutputLogToChannel(`Folder ${folder.uri.fsPath} does not include python files`, logUtils.logType.WARNING)
    }
  });
  return folderViews;
}

export async function getPythonPackageCollectionsForFolder(folderView: treeItems.FoldersView) {
  if (!folderView.folderVenv) {
    vscode.window.showErrorMessage(`${folderView.folderName} does not have a Python Interpreter set. Please set one, and then run scan for folder`)
    return
  }
  let ProjectDependencies = await getProjectDependencies(folderView.folderFsPath);
  let projectInitFolders = await getProjectInitFolders(folderView.folderFsPath);
  let PythonPackageCollections = await getPythonPackageCollections(ProjectDependencies, folderView.folderVenv, projectInitFolders);
  return PythonPackageCollections;
}

function extractParentFolder(path: string): string {
  const folders = path.split("/");
  const lastFolder = folders[folders.length - 2];
  return lastFolder;
}

async function getProjectInitFolders(workspaceFolder: string): Promise<string[]> {
  const initPyFolders = new Set<string>();

  // Read the contents of the directory
  const pythonInitFolders = glob.sync(`${workspaceFolder}/**/__init__.py`, { follow: followSymbolicLinks });

  // Check each file in the directory
  pythonInitFolders.forEach(async (folder) => {
    let initPyFolder = extractParentFolder(folder)
    initPyFolders.add(initPyFolder);
  })

  return Array.from(initPyFolders);
}

export async function getProjectPythonFiles(workspaceFolder: string): Promise<string[]> {
  const pythonFiles = glob.sync(`${workspaceFolder}/**/*.py`, { follow: followSymbolicLinks });
  return pythonFiles
}

export async function getProjectDependencies(workspaceFolder: string): Promise<string[]> {
  let ProjectPythonFiles: string[] = await getProjectPythonFiles(workspaceFolder)
  let ProjectDependencies = await scanProjectDependencies(ProjectPythonFiles);
  return ProjectDependencies;

}

export async function scanProjectDependencies(ProjectPythonFiles: string[]): Promise<string[]> {
  const importedPackages = new Set<string>();
  for (const file of ProjectPythonFiles) {
    const contents = fs.readFileSync(file, 'utf-8');
    const matches = contents.matchAll(/(?:^from|^import) ([a-zA-Z0-9_]+)(?:.*)/gm);
    for (const match of matches) {
      importedPackages.add(match[1])
    }
  }
  return Array.from(importedPackages)
}

export async function getPythonPackageCollections(ProjectDependencies: string[], folderVenv: string, projectInitFolders: string[]): Promise<treeItems.pythonPackageCollection[]> {
  const pythonPackageCollections: treeItems.pythonPackageCollection[] = []
  const installedPythonPackages: treeItems.pythonPackage[] = []
  const missingPythonPackages: treeItems.pythonPackage[] = []
  const privatePythonPackages: treeItems.pythonPackage[] = []

  logUtils.sendOutputLogToChannel(`Starting get package collections for folder: ${folderVenv}`, logUtils.logType.INFO)
  for (const packageName of ProjectDependencies) {
    logUtils.sendOutputLogToChannel(`Starting check for package: ${packageName}`, logUtils.logType.INFO)
    const cmd = cliCommands.getImportCmd(folderVenv, packageName);
    try {
      cp.execSync(cmd, { encoding: 'utf-8' });
    }
    catch (error) {
      if (error.message.includes('ModuleNotFoundError: No module named')) {
        logUtils.sendOutputLogToChannel(`The Pip package: ${packageName} cannot be imported: "ModuleNotFoundError"`, logUtils.logType.INFO)
        const packageIsPrivateModule = projectInitFolders.includes(packageName);
        if (packageIsPrivateModule) {
          logUtils.sendOutputLogToChannel(`The Pip package: ${packageName} seems to be a private module`, logUtils.logType.INFO)
          const privatePythonPackage = new treeItems.pythonPackage(
            packageName,
            null,
            folderVenv
          );
          privatePythonPackages.push(privatePythonPackage);
        } else {
          const validUrl = await checkUrlExists(`https://pypi.org/project/${packageName}/`);
          if (validUrl) {
            logUtils.sendOutputLogToChannel(`The Pip package: ${packageName} found in Pypi website considered as missing`, logUtils.logType.INFO)
            const missingPythonPackage = new treeItems.pythonPackage(
              packageName,
              null,
              folderVenv,
            );
            missingPythonPackage.contextValue = 'missingPythonPackage'
            missingPythonPackages.push(missingPythonPackage);
          } else {
            logUtils.sendOutputLogToChannel(`The Pip package: ${packageName} cannot be found in Pypi website`, logUtils.logType.INFO)
            const privatePythonPackage = new treeItems.pythonPackage(
              packageName,
              null,
              folderVenv
            );
            privatePythonPackages.push(privatePythonPackage);
          }
        }
      }
    }
    const packageNumber = await getPythonPackageNumber(packageName);
    logUtils.sendOutputLogToChannel(`The Pip package: ${packageName} version is: ${packageNumber}`, logUtils.logType.INFO)
    const installedPythonPackage = new treeItems.pythonPackage(
      packageName,
      packageNumber,
      folderVenv
    );
    installedPythonPackage.contextValue = 'installedPythonPackage'
    installedPythonPackages.push(installedPythonPackage);
  }



  if (installedPythonPackages.length > 0) {
    const installedPythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.INSTALLED,
      installedPythonPackages,
      installedPythonPackages[0].folderVenv
    )
    pythonPackageCollections.push(installedPythonPackageCollection)
  }

  if (missingPythonPackages.length > 0) {
    const missingPythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.MISSING,
      missingPythonPackages,
      missingPythonPackages[0].folderVenv
    )
    missingPythonPackageCollection.contextValue = 'missingPythonPackageCollection'
    pythonPackageCollections.push(missingPythonPackageCollection)
  }

  if (privatePythonPackages.length > 0) {
    const privatePythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.PRIVATE,
      privatePythonPackages,
      privatePythonPackages[0].folderVenv
    )
    pythonPackageCollections.push(privatePythonPackageCollection)
  }

  return pythonPackageCollections
}


export async function getPythonPackageNumber(pythonPackageName: string): Promise<string | undefined> {
  const cmd = cliCommands.getPipShowCmd(pythonPackageName);
  try {
    let stdout = cp.execSync(cmd, { encoding: 'utf-8' });
    let packageVersion = findVersion(stdout)
    return packageVersion
  }
  catch (error) {
    return null
  }
}

export async function checkUrlExists(url: string): Promise<boolean> {
  try {
    const response = await axios.head(url);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

export function extractVersion(line: string): string | null {
  const versionRegex = /^Version:\s+(.*)/i;
  const match = line.match(versionRegex);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

export function findVersion(multiLineString: string): string | null {
  const lines = multiLineString.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('Version')) {
      return extractVersion(trimmedLine);
    }
  }
  return null;
}

export async function getUserInput(prompt?: string, placeHolder?: string, validateInput?: boolean, inputErrorMessage?: string) {
  if (validateInput && !inputErrorMessage) {
    const errorLog = 'Internal function error: Asked to validate input without inputErrorMessage'
    logUtils.sendOutputLogToChannel(errorLog, logUtils.logType.ERROR)
    vscode.window.showErrorMessage(errorLog)
    throw new Error(errorLog);
  }

  const inputBoxOptions: vscode.InputBoxOptions = {
    placeHolder: placeHolder,
  };

  if (prompt) {
    inputBoxOptions.prompt = prompt;
  } else {
    inputBoxOptions.prompt = 'Please enter your input here';
  }

  if (validateInput) {
    inputBoxOptions.validateInput = (input: string) => {
      if (!input) {
        return inputErrorMessage;
      }
      return null;
    };
  }

  const userInput = await vscode.window.showInputBox(inputBoxOptions);
  return userInput;
}

function getActivePythonPath(pythonInterpreterPath: string): string {
  const wordsToReplace = ["python", "python3"];
  const pattern = new RegExp(wordsToReplace.join("|"), "g");
  const replacedPath = pythonInterpreterPath.replace(pattern, "activate");
  logUtils.sendOutputLogToChannel(`Path to run activate for env is: ${replacedPath}`, logUtils.logType.INFO)
  return replacedPath
}

export async function installMissingPackages(pythonPackageCollection: treeItems.pythonPackageCollection) {
  logUtils.sendOutputLogToChannel(`Start running Installation for missing packages`, logUtils.logType.INFO)
  await _installSelectedPackages(pythonPackageCollection.folderVenv, pythonPackageCollection.pythonPackages)
}

export async function installPackage(pythonPackage: treeItems.pythonPackage) {
  await _installSelectedPackages(pythonPackage.folderVenv, [pythonPackage])
}

export async function unInstallPypiPackage(pythonPackage: treeItems.pythonPackage) {
  await _unInstallSelectedPackages(pythonPackage.folderVenv, [pythonPackage])
}

export async function installPypiPackage(folderView: treeItems.FoldersView) {
  if (!folderView.folderVenv) {
    vscode.window.showErrorMessage(`${folderView.folderName} does not have a Python Interpreter set. Please set one, and then run scan for folder`)
    return
  }
  const pypiPackageName = await getUserInput(
    'Please provide Pypi package name',
    'Example: mangum',
    true,
    'Pypi package cannot be empty'
  )
  logUtils.sendOutputLogToChannel(`User input for package name is: ${pypiPackageName}`, logUtils.logType.INFO)
  vscode.window.showInformationMessage(`Checking ${pypiPackageName} is a valid Pypi package`)
  const validUrl = await checkUrlExists(`https://pypi.org/project/${pypiPackageName}/`);
  if (!validUrl) {
    logUtils.sendOutputLogToChannel(`${pypiPackageName} is not a valid package name, as we cannot find it in Pypi site`, logUtils.logType.ERROR)
    vscode.window.showErrorMessage(`${pypiPackageName} is not a valid package name`)
    return
  }
  const pypiPackageVersion = await getUserInput(
    'Please provide the desired Pypi package version',
    'Example: 0.17.0',
    false,
  )
  if (!pypiPackageVersion) {
    logUtils.sendOutputLogToChannel(`No version was provided for ${pypiPackageName} will install the latest version`, logUtils.logType.WARNING)
    vscode.window.showWarningMessage(`No version was provided for ${pypiPackageName} will install the latest version`)
  }
  _installPypiPackageTerminal(folderView.folderVenv, pypiPackageName, pypiPackageVersion)
}

async function _installPypiPackageTerminal(folderVenv: string, pypiPackageName: string, pypiPackageVersion?: string) {
  const activePythonPath = getActivePythonPath(folderVenv)
  const sourceCliCommand = cliCommands.getSourceCmd(activePythonPath)
  let installCliCommand = cliCommands.getPipInstallCmd(pypiPackageName, pypiPackageVersion)
  await cliCommands.safeRunCliCmd(sourceCliCommand, true)
  await cliCommands.safeRunCliCmd(installCliCommand, true)
  const finishedLog = `Finished installing : ${pypiPackageName}`
  logUtils.sendOutputLogToChannel(finishedLog, logUtils.logType.INFO)
  vscode.window.showInformationMessage(finishedLog)
}

async function _getInstalledPackages(folderVenv: string, selectedPackages: treeItems.pythonPackage[]): Promise<string[]> {
  const packagesToInstall: string[] = [];
  for (var pythonPackage of selectedPackages) {
    let cmd = cliCommands.getImportCmd(folderVenv, pythonPackage.pipPackageName);
    try {
      cp.execSync(cmd, { encoding: 'utf-8' });
    }
    catch (error) {
      packagesToInstall.push(pythonPackage.pipPackageName);
    }
  }
  return packagesToInstall
}

async function _unInstallSelectedPackages(folderVenv: string, selectedPackages: treeItems.pythonPackage[]) {
  const activePythonPath = getActivePythonPath(folderVenv)
  const sourceCliCommand = cliCommands.getSourceCmd(activePythonPath)
  await cliCommands.safeRunCliCmd(sourceCliCommand, true)
  for (var pipPackage of selectedPackages) {
    let unInstallPypiPackageCliCmd = cliCommands.getPipUnInstallCmd(pipPackage.pipPackageName)
    await cliCommands.safeRunCliCmd(unInstallPypiPackageCliCmd, true)
    logUtils.sendOutputLogToChannel(`Finished uninstalling: ${pipPackage.pipPackageName}`, logUtils.logType.INFO)
  }
  vscode.window.showInformationMessage('Finished uninstalling operations')
}

async function _installSelectedPackages(folderVenv: string, selectedPackages: treeItems.pythonPackage[]) {
  const activePythonPath = getActivePythonPath(folderVenv)
  const sourceCliCommand = cliCommands.getSourceCmd(activePythonPath)
  const packagesToInstall = await _getInstalledPackages(folderVenv, selectedPackages);
  logUtils.sendOutputLogToChannel(`Pypi packages to install are: ${packagesToInstall.join(', ')}`, logUtils.logType.INFO)
  if (packagesToInstall.length > 0) {
    await cliCommands.safeRunCliCmd(sourceCliCommand, true)
    for (var packageToInstall of packagesToInstall) {
      let InstallPypiPackageCliCmd = cliCommands.getPipInstallCmd(packageToInstall)
      await cliCommands.safeRunCliCmd(InstallPypiPackageCliCmd, true)
      logUtils.sendOutputLogToChannel(`Finished installing package: ${packageToInstall}`, logUtils.logType.INFO)
    }
  }
}

export async function updatePackage(pythonPackage: treeItems.pythonPackage) {
  _updateSelectedPackages(pythonPackage.folderVenv, [pythonPackage])
}

async function _updateSelectedPackages(folderVenv: string, selectedPackages: treeItems.pythonPackage[]) {
  const activePythonPath = getActivePythonPath(folderVenv)
  const sourceCliCommand = cliCommands.getSourceCmd(activePythonPath)
  const packagesCannotUpdate: string[] = [];
  const packagesToUpdate: string[] = [];
  const updatedPackages: string[] = [];
  for (var pythonPackage of selectedPackages) {
    let cmd = cliCommands.getImportCmd(folderVenv, pythonPackage.pipPackageName);
    try {
      cp.execSync(cmd, { encoding: 'utf-8' });
      packagesToUpdate.push(pythonPackage.pipPackageName)
    }
    catch (error) {
      packagesCannotUpdate.push(pythonPackage.pipPackageName)
    }
  }
  if (packagesToUpdate.length > 0) {
    logUtils.sendOutputLogToChannel(`About to update following Pypi packages: ${packagesToUpdate.join(', ')}`, logUtils.logType.INFO)
    await cliCommands.safeRunCliCmd(sourceCliCommand, true)
    for (var packageToUpdate of packagesToUpdate) {
      let pipUpgradeCmd = cliCommands.getPipUpgradeCmd(packageToUpdate)
      await cliCommands.safeRunCliCmd(pipUpgradeCmd, true)
      updatedPackages.push(packageToUpdate)
      logUtils.sendOutputLogToChannel(`Finished running update operation for: ${packageToUpdate}`, logUtils.logType.INFO)
    }
  }
  logUtils.sendOutputLogToChannel(`Successfully updated python packages: ${updatedPackages.join(', ')}`, logUtils.logType.INFO)
  vscode.window.showInformationMessage(`Successfully updated python packages: ${updatedPackages.join(', ')}`)
  if (packagesCannotUpdate.length > 0) {
    logUtils.sendOutputLogToChannel(`Successfully updated python packages: ${updatedPackages.join(', ')}, packages cannot be imported`, logUtils.logType.WARNING)
    vscode.window.showWarningMessage(`Unable to updated python packages: ${packagesCannotUpdate.join(', ')}, packages cannot be imported`)
  }
}