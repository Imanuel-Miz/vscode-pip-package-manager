import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as cp from 'child_process';
import axios from 'axios';
import * as treeItems from '../treeView/TreeItems';
import * as cliCommands from './cliCommands';
import * as logUtils from './logUtils';
import path from 'path';
const extensionConfig = vscode.workspace.getConfiguration('pipPackageManager')
const followSymbolicLinks: boolean = extensionConfig.get('followSymbolicLinks')

interface pickListItem {
  name: string;
  description: string;
}


export function updateConfiguration(configSetting: string, configValue: any) {
  logUtils.sendOutputLogToChannel(`About to update config setting: ${configSetting}, with value: ${configValue}`, logUtils.logType.INFO)
  extensionConfig.update(configSetting, configValue, vscode.ConfigurationTarget.Workspace)
}

function checkFolderForPyFiles(folderPath: string): boolean {
  const pythonFiles = glob.sync(`${folderPath}/**/*.py`);
  return pythonFiles.length > 0;
}

export function isVirtualEnvironment(interpreterPath?: string): boolean | null {
  if (interpreterPath) {
    const virtualEnvFolder = path.dirname(path.dirname(interpreterPath));
    const pyvenvCfgPath = `${virtualEnvFolder}/pyvenv.cfg`;
    const isVirtualEnv = fs.existsSync(pyvenvCfgPath);
    return isVirtualEnv;
  }
  return null
}

export function enrichInfoFromPythonExtension(folderViews: treeItems.FoldersView[], pythonExtensionConfig: vscode.Extension<any>) {
  const systemPythonExecutables = new Set<string>();
  folderViews.forEach((folderView) => {
    for (let key in pythonExtensionConfig.exports.environments["known"]) {
      let env_info = pythonExtensionConfig.exports.environments["known"][key];
      let pythonExecutable: string | null = env_info?.internal?.executable?.uri?.path
      if (pythonExecutable) {
        systemPythonExecutables.add(pythonExecutable)
      }
      try {
        if (env_info["internal"]["environment"]["workspaceFolder"]["name"] === folderView.folderName) {
          let pythonInterpreterPath = env_info["internal"]["path"]
          folderView.pythonInterpreterPath = pythonInterpreterPath
          folderView.isVenv = isVirtualEnvironment(pythonInterpreterPath)
        }
      } catch (error) {
        continue
      }
    }
  })
  const systemPythonExecutablesList = Array.from(systemPythonExecutables)
  logUtils.sendOutputLogToChannel(`Full system python executables found: ${systemPythonExecutablesList}`, logUtils.logType.INFO)
  folderViews.forEach((folderView) => {
    folderView.systemPythonExecutables = systemPythonExecutablesList
    if (!folderView.pythonInterpreterPath) {
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
  if (!folderView.pythonInterpreterPath) {
    vscode.window.showErrorMessage(`${folderView.folderName} does not have a Python Interpreter set. Please set one, and then run scan for folder`)
    return
  }
  let ProjectDependencies = await getProjectDependencies(folderView.folderFsPath);
  logUtils.sendOutputLogToChannel(`All Project dependencies for: ${folderView.folderName} are: ${ProjectDependencies.join(', ')}`, logUtils.logType.INFO)
  let projectInitFolders = await getProjectInitFolders(folderView.folderFsPath);
  let PythonPackageCollections = await getPythonPackageCollections(ProjectDependencies, folderView.pythonInterpreterPath, projectInitFolders, folderView.folderName);
  return PythonPackageCollections;
}

async function getProjectInitFolders(workspaceFolder: string): Promise<string[]> {
  const initPyFolders = new Set<string>();

  // Read the contents of the directory
  const pythonInitPaths = glob.sync(`${workspaceFolder}/**/__init__.py`, { follow: followSymbolicLinks });

  // Check each file in the directory
  pythonInitPaths.forEach(async (pythonInitPath) => {
    let initPyFolder = path.basename(path.dirname(pythonInitPath))
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

export async function getPythonPackageCollections(ProjectDependencies: string[], pythonInterpreterPath: string, projectInitFolders: string[], folderName: string): Promise<treeItems.pythonPackageCollection[]> {
  const pythonPackageCollections: treeItems.pythonPackageCollection[] = []
  const installedPythonPackages: treeItems.pythonPackage[] = []
  const missingPythonPackages: treeItems.pythonPackage[] = []
  const privatePythonPackages: treeItems.pythonPackage[] = []

  logUtils.sendOutputLogToChannel(`Starting get package collections for folder: ${folderName}`, logUtils.logType.INFO)
  for (const packageName of ProjectDependencies) {
    logUtils.sendOutputLogToChannel(`Starting check for package: ${packageName}`, logUtils.logType.INFO)
    const cmd = cliCommands.getImportCmd(pythonInterpreterPath, packageName);
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
            pythonInterpreterPath
          );
          privatePythonPackages.push(privatePythonPackage);
        } else {
          const validUrl = await checkUrlExists(`https://pypi.org/project/${packageName}/`);
          if (validUrl) {
            logUtils.sendOutputLogToChannel(`The Pip package: ${packageName} found in Pypi website considered as missing`, logUtils.logType.INFO)
            const missingPythonPackage = new treeItems.pythonPackage(
              packageName,
              null,
              pythonInterpreterPath,
            );
            missingPythonPackage.contextValue = 'missingPythonPackage'
            missingPythonPackages.push(missingPythonPackage);
          } else {
            logUtils.sendOutputLogToChannel(`The Pip package: ${packageName} cannot be found in Pypi website`, logUtils.logType.INFO)
            const privatePythonPackage = new treeItems.pythonPackage(
              packageName,
              null,
              pythonInterpreterPath
            );
            privatePythonPackages.push(privatePythonPackage);
          }
        }
      }
    }
    const packageNumber = await getPythonPackageNumber(packageName);
    if (packageNumber != null) {
      logUtils.sendOutputLogToChannel(`The Pip package: ${packageName} version is: ${packageNumber}`, logUtils.logType.INFO)
      const installedPythonPackage = new treeItems.pythonPackage(
        packageName,
        packageNumber,
        pythonInterpreterPath
      );
      installedPythonPackage.contextValue = 'installedPythonPackage'
      installedPythonPackages.push(installedPythonPackage);
    }
  }



  if (installedPythonPackages.length > 0) {
    const installedPythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.INSTALLED,
      installedPythonPackages,
      installedPythonPackages[0].pythonInterpreterPath
    )
    pythonPackageCollections.push(installedPythonPackageCollection)
  }

  if (missingPythonPackages.length > 0) {
    const missingPythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.MISSING,
      missingPythonPackages,
      missingPythonPackages[0].pythonInterpreterPath
    )
    missingPythonPackageCollection.contextValue = 'missingPythonPackageCollection'
    pythonPackageCollections.push(missingPythonPackageCollection)
  }
  else {
    const missingPythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.MISSING,
      [],
      undefined
    )
    missingPythonPackageCollection.contextValue = 'missingPythonPackageCollection'
    pythonPackageCollections.push(missingPythonPackageCollection)
  }

  if (privatePythonPackages.length > 0) {
    const privatePythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.PRIVATE,
      privatePythonPackages,
      privatePythonPackages[0].pythonInterpreterPath
    )
    pythonPackageCollections.push(privatePythonPackageCollection)
  }
  else {
    const privatePythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.PRIVATE,
      [],
      undefined
    )
    pythonPackageCollections.push(privatePythonPackageCollection)
  }

  return pythonPackageCollections
}


export async function getPythonPackageNumber(pythonPackageName: string): Promise<string | null> {
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

export async function installMissingPackages(pythonPackageCollection: treeItems.pythonPackageCollection) {
  logUtils.sendOutputLogToChannel(`Start running Installation for missing packages`, logUtils.logType.INFO)
  await _installSelectedPackages(pythonPackageCollection.pythonInterpreterPath, pythonPackageCollection.pythonPackages)
}

export async function installPackage(pythonPackage: treeItems.pythonPackage) {
  await _installSelectedPackages(pythonPackage.pythonInterpreterPath, [pythonPackage])
}

export async function unInstallPypiPackage(pythonPackage: treeItems.pythonPackage) {
  await _unInstallSelectedPackages(pythonPackage.pythonInterpreterPath, [pythonPackage])
}

export async function installPypiPackage(folderView: treeItems.FoldersView) {
  if (!folderView.pythonInterpreterPath) {
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
  _installPypiPackageTerminal(folderView.pythonInterpreterPath, pypiPackageName, pypiPackageVersion)
}

async function _installPypiPackageTerminal(pythonInterpreterPath: string, pypiPackageName: string, pypiPackageVersion?: string) {
  let installCliCommand = cliCommands.getPipInstallCmd(pypiPackageName, pypiPackageVersion)
  await cliCommands.safeRunCliCmd([installCliCommand], pythonInterpreterPath, true)
  const finishedLog = `Finished installing: ${pypiPackageName}`
  logUtils.sendOutputLogToChannel(finishedLog, logUtils.logType.INFO)
  vscode.window.showInformationMessage(finishedLog)
}

async function _getPackagesToInstall(pythonInterpreterPath: string, selectedPackages: treeItems.pythonPackage[]): Promise<string[]> {
  const packagesToInstall: string[] = [];
  for (var pythonPackage of selectedPackages) {
    let cmd = cliCommands.getImportCmd(pythonInterpreterPath, pythonPackage.pipPackageName);
    try {
      cp.execSync(cmd, { encoding: 'utf-8' });
    }
    catch (error) {
      packagesToInstall.push(pythonPackage.pipPackageName);
    }
  }
  return packagesToInstall
}

async function _unInstallSelectedPackages(pythonInterpreterPath: string, selectedPackages: treeItems.pythonPackage[]) {
  let unInstalledPackages: string[] = []
  for (var pipPackage of selectedPackages) {
    let unInstallPypiPackageCliCmd = cliCommands.getPipUnInstallCmd(pipPackage.pipPackageName)
    let stdout = await cliCommands.safeRunCliCmd([unInstallPypiPackageCliCmd], pythonInterpreterPath, true, true)
    if (stdout.toLowerCase().includes('successfully')) {
      unInstalledPackages.push(pipPackage.pipPackageName)
      logUtils.sendOutputLogToChannel(`Finished uninstalling: ${pipPackage.pipPackageName}`, logUtils.logType.INFO)
    }
    else {
      logUtils.sendOutputLogToChannel(`There was an error uninstalling: ${pipPackage.pipPackageName}, please review the extension logs for more info`, logUtils.logType.WARNING)
    }
  }
  logUtils.sendOutputLogToChannel(`Finished uninstalling: ${unInstalledPackages.join(', ')}`, logUtils.logType.INFO)
  vscode.window.showInformationMessage('Finished uninstall operations')
}

async function _installSelectedPackages(pythonInterpreterPath: string, selectedPackages: treeItems.pythonPackage[]) {
  const packagesToInstall = await _getPackagesToInstall(pythonInterpreterPath, selectedPackages);
  logUtils.sendOutputLogToChannel(`Pypi packages to install are: ${packagesToInstall.join(', ')}`, logUtils.logType.INFO)
  if (packagesToInstall.length > 0) {
    for (var packageToInstall of packagesToInstall) {
      let InstallPypiPackageCliCmd = cliCommands.getPipInstallCmd(packageToInstall)
      let stdout = await cliCommands.safeRunCliCmd([InstallPypiPackageCliCmd], pythonInterpreterPath, true, true)
      if (stdout.toLowerCase().includes('successfully')) {
        logUtils.sendOutputLogToChannel(`Finished installing: ${packageToInstall}`, logUtils.logType.INFO)
      }
      else {
        logUtils.sendOutputLogToChannel(`There was an error installing: ${packageToInstall}, please review the extension logs for more info`, logUtils.logType.WARNING)
      }
    }
  }
  logUtils.sendOutputLogToChannel(`Finished installing packages: ${packagesToInstall.join(', ')}`, logUtils.logType.INFO)
  vscode.window.showInformationMessage('Finished installation operations')
}

export async function updatePackage(pythonPackage: treeItems.pythonPackage) {
  _updateSelectedPackages(pythonPackage.pythonInterpreterPath, [pythonPackage])
}

async function _updateSelectedPackages(pythonInterpreterPath: string, selectedPackages: treeItems.pythonPackage[]) {
  const packagesCannotUpdate: string[] = [];
  const packagesToUpdate: string[] = [];
  const updatedPackages: string[] = [];
  for (var pythonPackage of selectedPackages) {
    let cmd = cliCommands.getImportCmd(pythonInterpreterPath, pythonPackage.pipPackageName);
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
    for (var packageToUpdate of packagesToUpdate) {
      let pipUpgradeCmd = cliCommands.getPipUpgradeCmd(packageToUpdate)
      let stdout = await cliCommands.safeRunCliCmd([pipUpgradeCmd], pythonInterpreterPath, true, true)
      if (stdout.toLowerCase().includes('successfully')) {
        logUtils.sendOutputLogToChannel(`Finished updating: ${packageToUpdate}`, logUtils.logType.INFO)
        updatedPackages.push(packageToUpdate)
      }
      else {
        logUtils.sendOutputLogToChannel(`There was an error updating: ${packageToUpdate}, please review the extension logs for more info`, logUtils.logType.WARNING)
      }
    }
    logUtils.sendOutputLogToChannel(`Successfully updated python packages: ${updatedPackages.join(', ')}`, logUtils.logType.INFO)
    vscode.window.showInformationMessage(`Successfully updated python packages: ${updatedPackages.join(', ')}`)
  }

  if (packagesCannotUpdate.length > 0) {
    logUtils.sendOutputLogToChannel(`Unable to updated python packages: ${updatedPackages.join(', ')}, packages cannot be imported`, logUtils.logType.WARNING)
    vscode.window.showWarningMessage(`Unable to updated python packages: ${packagesCannotUpdate.join(', ')}, packages cannot be imported`)
  }
}

export async function installRequirementFile(folderView: treeItems.FoldersView) {
  if (!folderView.pythonInterpreterPath) {
    vscode.window.showErrorMessage(`${folderView.folderName} does not have a Python Interpreter set. Please set one, and then run scan for folder`)
    return
  }
  const requirementFilePath = await getUserInput(
    'Please provide a full path to the requirement.txt file',
    undefined, true, 'Path cannot be empty'
  )
  if (fs.existsSync(requirementFilePath)!) {
    logUtils.sendOutputLogToChannel(`Unable to find requirement.txt file on path: ${requirementFilePath}`, logUtils.logType.ERROR)
    vscode.window.showErrorMessage(`The provided file path cannot be found: ${requirementFilePath}. Please verify file location on the system`)
  }
  await _runInstallRequirementFile(requirementFilePath, folderView.pythonInterpreterPath)
}

async function _runInstallRequirementFile(requirementFilePath: string, pythonInterpreterPath: string) {
  const pipInstallRequirementFileCmd = cliCommands.getPipInstallRequirementFileCmd(requirementFilePath)
  await cliCommands.safeRunCliCmd([pipInstallRequirementFileCmd], pythonInterpreterPath, true)
  logUtils.sendOutputLogToChannel(`Finished running installation for requirement file: ${requirementFilePath}, please review extension logs for more info`, logUtils.logType.INFO)
  vscode.window.showInformationMessage(`Finished running installation for requirement file: ${requirementFilePath}.`)
}

export async function scanInstallRequirementsFile(folderView: treeItems.FoldersView) {
  if (!folderView.pythonInterpreterPath) {
    vscode.window.showErrorMessage(`${folderView.folderName} does not have a Python Interpreter set. Please set one, and then run scan for folder`)
    return
  }
  const projectRequirementsFiles = glob.sync(`${folderView.folderFsPath}/**/requirements.txt`);
  if (projectRequirementsFiles.length === 0) {
    logUtils.sendOutputLogToChannel(`Unable to find requirements.txt files in your project`, logUtils.logType.INFO)
    vscode.window.showInformationMessage(`Unable to find requirements.txt files in your project. Not running any action`)
  }
  else {
    logUtils.sendOutputLogToChannel(`Found number of requirements.txt files: ${projectRequirementsFiles.length}: ${projectRequirementsFiles.join(', ')}`, logUtils.logType.INFO)
    for (var requirementFilePath of projectRequirementsFiles) {
      logUtils.sendOutputLogToChannel(`Running installation for requirements.txt file: ${requirementFilePath}`, logUtils.logType.INFO)
      await _runInstallRequirementFile(requirementFilePath, folderView.pythonInterpreterPath)
    }
  }
}

async function getSystemPythonExecutablesAsVscodePickList(systemPythonExecutables: string[]): Promise<vscode.QuickPickItem[]> {
  const pickListItems: pickListItem[] = []
  for (const [index, value] of systemPythonExecutables.entries()) {
    let singlePickListItem = { 'name': String(index + 1), 'description': value }
    pickListItems.push(singlePickListItem)
  }
  const systemPythonExecutablesAsVscodePickList: vscode.QuickPickItem[] = pickListItems.map((item) => ({
    label: item.name,
    description: item.description,
  }));
  const chooseFilePick = { label: 'Choose File', description: 'Select a file path from the system' }
  systemPythonExecutablesAsVscodePickList.unshift(chooseFilePick)
  return systemPythonExecutablesAsVscodePickList
}

export async function getPythonInterpreterFromUser(folder: treeItems.FoldersView): Promise<string | null> {
  let chosenPythonInterpreter: string | null = null
  const options: vscode.QuickPickItem[] = await getSystemPythonExecutablesAsVscodePickList(folder.systemPythonExecutables)
  let userQuickPick = await vscode.window.showQuickPick(options, {
    canPickMany: false,
    title: 'Choose Python Interpreter',
    placeHolder: 'Please select python interpreter from the list, or choose a file from the system'
  })
  if (userQuickPick) {
    if (userQuickPick.label === 'Choose File') {
      // Show the file picker dialog to select a file
      const fileUri = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: 'Select File',
      });

      if (fileUri && fileUri[0]) {
        // User selected a file
        const filePath = fileUri[0].fsPath;
        logUtils.sendOutputLogToChannel(`Folder interpreter chosen from system: ${filePath}`, logUtils.logType.INFO)
        chosenPythonInterpreter = filePath
      } else {
        // User canceled the file selection
        logUtils.sendOutputLogToChannel(`Folder interpreter selection canceled for: ${folder.name}`, logUtils.logType.WARNING)
      }
    }
    else {
      logUtils.sendOutputLogToChannel(`user quick pick chosen item for python path is: ${JSON.stringify(userQuickPick, undefined, 4)}`, logUtils.logType.INFO)
      chosenPythonInterpreter = userQuickPick.description
    }
  }
  if (!chosenPythonInterpreter) {
    logUtils.sendOutputLogToChannel(`No python interpreter was chosen for: ${folder.name}`, logUtils.logType.WARNING)
  }
  return chosenPythonInterpreter
}
