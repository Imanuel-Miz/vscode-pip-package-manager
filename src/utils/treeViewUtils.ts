import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as glob from 'glob';
import * as cp from 'child_process';
import axios from 'axios';
import * as treeItems from '../treeView/TreeItems'
const extensionConfig = vscode.workspace.getConfiguration('pipPackageManager')
const followSymbolicLinks: boolean = extensionConfig.get('followSymbolicLinks')

export function updateConfiguration(configSetting: string, configValue: any) {
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
      console.log(`Folder ${folder.uri.fsPath} does not include python files`)
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

  console.log(`Starting get package collections`)
  for (const packageName of ProjectDependencies) {
    console.log(`Starting check for package: ${packageName}`);
    const cmd = `${folderVenv} -c "import ${packageName}"`;
    try {
      cp.execSync(cmd, { encoding: 'utf-8' });
    }
    catch (error) {
      if (error.message.includes('ModuleNotFoundError: No module named')) {
        const packageIsPrivateModule = projectInitFolders.includes(packageName);
        if (packageIsPrivateModule) {
          const privatePythonPackage = new treeItems.pythonPackage(
            packageName,
            null,
            folderVenv
          );
          privatePythonPackages.push(privatePythonPackage);
        } else {
          const validUrl = await checkUrlExists(`https://pypi.org/project/${packageName}/`);
          if (validUrl) {
            const missingPythonPackage = new treeItems.pythonPackage(
              packageName,
              null,
              folderVenv,
            );
            missingPythonPackage.contextValue = 'missingPythonPackage'
            missingPythonPackages.push(missingPythonPackage);
          } else {
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
  const cmd = `pip show ${pythonPackageName}`;
  console.log(`About to run show pip for package: ${pythonPackageName}`)
  try {
    let stdout = cp.execSync(cmd, { encoding: 'utf-8' });
    let packageVersion = findVersion(stdout)
    console.log(`packageVersion is: ${packageVersion}`)
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
    throw new Error('Asked to validate input without inputErrorMessage');
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
  return replacedPath
}

export async function installMissingPackages(pythonPackageCollection: treeItems.pythonPackageCollection) {
  _installSelectedPackages(pythonPackageCollection.folderVenv, pythonPackageCollection.pythonPackages)
}

export async function installPackage(pythonPackage: treeItems.pythonPackage) {
  _installSelectedPackages(pythonPackage.folderVenv, [pythonPackage])
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
  vscode.window.showInformationMessage(`Checking ${pypiPackageName} is a valid Pypi package`)
  const validUrl = await checkUrlExists(`https://pypi.org/project/${pypiPackageName}/`);
  if (!validUrl) {
    vscode.window.showErrorMessage(`${pypiPackageName} is not a valid package name`)
    return
  }
  const pypiPackageVersion = await getUserInput(
    'Please provide the desired Pypi package version',
    'Example: 0.17.0',
    false,
  )
  if (!pypiPackageVersion) {
    vscode.window.showWarningMessage(`No version was provided for ${pypiPackageName} will install the latest version`)
  }
  _installPypiPackageTerminal(folderView.folderVenv, pypiPackageName, pypiPackageVersion)
}

function _installPypiPackageTerminal(folderVenv: string, pypiPackageName: string, pypiPackageVersion?: string) {
  let installSyntax = `pip3 install ${pypiPackageName}`
  if (pypiPackageVersion) {
    installSyntax += `==${pypiPackageVersion}`
  }
  const activePythonPath = getActivePythonPath(folderVenv)
  const terminal = vscode.window.createTerminal();
  terminal.show();
  terminal.sendText(`source ${activePythonPath}`);
  terminal.sendText(installSyntax);
}

async function _installSelectedPackages(folderVenv: string, selectedPackages: treeItems.pythonPackage[]) {
  const activePythonPath = getActivePythonPath(folderVenv)
  const packagesToInstall: string[] = [];
  const installedPackages: string[] = [];
  await _getInstalledPackages();
  await _runInstallPackages();
  vscode.window.showInformationMessage(`Successfully installed python packages: ${installedPackages.join(', ')}`)

  async function _runInstallPackages() {
    if (packagesToInstall.length > 0) {
      const terminal = vscode.window.createTerminal();
      terminal.show();
      terminal.sendText(`source ${activePythonPath}`);
      for (var packageToInstall of packagesToInstall) {
        terminal.sendText(`pip3 install ${packageToInstall}`);
        installedPackages.push(packageToInstall);
      }
    }
  }

  async function _getInstalledPackages() {
    for (var pythonPackage of selectedPackages) {
      const cmd = `${folderVenv} -c "import ${pythonPackage.pipPackageName}"`;
      try {
        cp.execSync(cmd, { encoding: 'utf-8' });
      }
      catch (error) {
        packagesToInstall.push(pythonPackage.pipPackageName);
      }
    }
  }
}

export async function updatePackage(pythonPackage: treeItems.pythonPackage) {
  _updateSelectedPackages(pythonPackage.folderVenv, [pythonPackage])
}

function _updateSelectedPackages(folderVenv: string, selectedPackages: treeItems.pythonPackage[]) {
  const activePythonPath = getActivePythonPath(folderVenv)
  const packagesCannotUpdate: string[] = [];
  const packagesToUpdate: string[] = [];
  const updatedPackages: string[] = [];
  for (var pythonPackage of selectedPackages) {
    const cmd = `${folderVenv} -c "import ${pythonPackage.pipPackageName}"`;
    try {
      cp.execSync(cmd, { encoding: 'utf-8' });
      packagesToUpdate.push(pythonPackage.pipPackageName)
    }
    catch (error) {
      packagesCannotUpdate.push(pythonPackage.pipPackageName)
    }
  }
  if (packagesToUpdate.length > 0) {
    const terminal = vscode.window.createTerminal();
    terminal.sendText(`source ${activePythonPath}`);
    for (var packageToInstall of packagesToUpdate) {
      terminal.sendText(`pip3 install --upgrade ${packageToInstall}`);
      updatedPackages.push(packageToInstall)
    }
  }
  vscode.window.showInformationMessage(`Successfully updated python packages: ${updatedPackages.join(', ')}`)
  if (packagesCannotUpdate.length > 0) {
    vscode.window.showWarningMessage(`Unable to updated python packages: ${packagesCannotUpdate.join(', ')}`)
  }
}