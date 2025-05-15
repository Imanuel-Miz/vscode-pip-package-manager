import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as cp from 'child_process';
import { exec } from 'child_process';
import * as treeItems from '../treeView/TreeItems';
import * as cliCommands from './cliCommands';
import * as logUtils from './logUtils';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import globModule from 'glob';
import glob from 'glob';
import path from 'path';
import { getUniquePythonPackageNamesFile } from './operationUtils';
import { pipPackagesDict } from '../pgk_list/pipPackagesDict';
const extensionConfig = vscode.workspace.getConfiguration('pipPackageManager')
const followSymbolicLinks: boolean = extensionConfig.get('followSymbolicLinks')
const promiseGlob = promisify(globModule);
const pythonFoldersToIgnore: Array<string> = [
  '**/venv/**',
  '**/.venv/**',
  '**/__pycache__/**',
  '**/.tox/**',
  '**/*.egg-info/**',
]

interface pickListItem {
  name: string;
  description: string;
}


export function updateConfiguration(configSetting: string, configValue: any) {
  logUtils.sendOutputLogToChannel(`About to update config setting: ${configSetting}, with value: ${configValue}`, logUtils.logType.INFO)
  extensionConfig.update(configSetting, configValue, vscode.ConfigurationTarget.Workspace)
}

function checkFolderForPyFiles(folderPath: string): boolean {
  const normalizedFolder = folderPath.replace(/\\/g, '/');
  const pythonFiles = glob.sync(`${normalizedFolder}/**/*.py`, { ignore: pythonFoldersToIgnore });
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
        logUtils.sendOutputLogToChannel(`Found raw executable: ${pythonExecutable} for workspace: ${folderView.folderName}`, logUtils.logType.INFO)
        try {
          pythonExecutable = fileURLToPath('file://' + pythonExecutable)
          pythonExecutable = path.normalize(pythonExecutable);
          logUtils.sendOutputLogToChannel(`Normalized executable: ${pythonExecutable}`, logUtils.logType.INFO)
          systemPythonExecutables.add(pythonExecutable)
        }
        catch (error) {
          logUtils.sendOutputLogToChannel(`There was an error normalizing executable: ${error}`, logUtils.logType.WARNING)
          continue
        }
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
  let ProjectDependencies: Record<string, string[]> = await getProjectDependencies(folderView.folderFsPath);
  const dependencyKeys = Object.keys(ProjectDependencies).join(', ');
  logUtils.sendOutputLogToChannel(`All Project dependencies for: ${folderView.folderName} are: ${dependencyKeys}`, logUtils.logType.INFO)
  let projectInitFolders = await getProjectInitFolders(folderView.folderFsPath);
  let PythonPackageCollections = await getPythonPackageCollections(ProjectDependencies, folderView.pythonInterpreterPath, projectInitFolders, folderView.folderName);
  return PythonPackageCollections;
}

async function getProjectInitFolders(workspaceFolder: string): Promise<string[]> {
  const initPyFolders = new Set<string>();
  const normalizedWorkspace = workspaceFolder.replace(/\\/g, '/');

  // Read the contents of the directory
  const pythonInitPaths = await promiseGlob(`${normalizedWorkspace}/**/__init__.py`, {
    follow: followSymbolicLinks,
    ignore: pythonFoldersToIgnore
  });

  // Check each file in the directory
  pythonInitPaths.forEach(async (pythonInitPath) => {
    let initPyFolder = path.basename(path.dirname(pythonInitPath))
    initPyFolders.add(initPyFolder);
  })

  return Array.from(initPyFolders);
}

export async function getProjectPythonFiles(workspaceFolder: string): Promise<string[]> {
  // Normalize workspaceFolder to use forward slashes (cross-platform glob safety)
  const normalizedWorkspace = workspaceFolder.replace(/\\/g, '/');
  const files = await promiseGlob(`${normalizedWorkspace}/**/*.py`, {
    follow: followSymbolicLinks,
    ignore: pythonFoldersToIgnore,
  });
  const pythonFiles = new Set<string>();
  for (const file of files) {
    pythonFiles.add(path.resolve(file));
  }

  return Array.from(pythonFiles);
}

export async function getProjectDependencies(workspaceFolder: string): Promise<Record<string, string[]>> {
  const projectPythonFiles: string[] = await getProjectPythonFiles(workspaceFolder);
  const projectDependencies = await scanProjectDependencies(projectPythonFiles);
  return projectDependencies;
}

export async function scanProjectDependencies(projectPythonFiles: string[]): Promise<Record<string, string[]>> {
  const importMap: Record<string, Set<string>> = {};

  for (const file of projectPythonFiles) {
    const contents = fs.readFileSync(file, 'utf-8');

    const matches = contents.matchAll(/(?:^from|^import) ([a-zA-Z0-9_]+)(?:.*)/gm);
    for (const match of matches) {
      const importName = match[1];
      if (!importMap[importName]) {
        importMap[importName] = new Set<string>();
      }
      importMap[importName].add(path.resolve(file));
    }
  }

  // Convert Set<string> to string[]
  const result: Record<string, string[]> = {};
  for (const [pkg, files] of Object.entries(importMap)) {
    result[pkg] = Array.from(files);
  }

  return result;
}

export async function getPythonPackageCollections(ProjectDependencies: Record<string, string[]>, pythonInterpreterPath: string, projectInitFolders: string[], folderName: string): Promise<treeItems.pythonPackageCollection[]> {

  // --- Collection Arrays ---
  const pythonPackageCollections: treeItems.pythonPackageCollection[] = [];
  const installedPythonPackages: treeItems.pythonPackage[] = [];
  const missingPythonPackages: treeItems.pythonPackage[] = [];
  const privatePythonPackages: treeItems.pythonPackage[] = [];
  const rawImports: treeItems.pythonPackage[] = [];

  // --- Logging: Start ---
  logUtils.sendOutputLogToChannel(
    `Starting get package collections for folder: ${folderName}`,
    logUtils.logType.INFO
  );

  // --- Main Processing Loop ---
  for (const [rawImportName, fileNames] of Object.entries(ProjectDependencies)) {
    logUtils.sendOutputLogToChannel(
      `Adding raw import: ${rawImportName}`,
      logUtils.logType.INFO
    );

    // Build pythonFiles for this import
    const pythonFiles: treeItems.pythonFile[] = [];
    for (const fileName of fileNames) {
      const pythonFile = new treeItems.pythonFile(fileName);
      pythonFile.contextValue = treeItems.treeContext.PYTHON_FILE;
      pythonFiles.push(pythonFile);
    }

    // Create rawImport package
    const rawImport = new treeItems.pythonPackage(
      rawImportName,
      null,
      pythonInterpreterPath,
      pythonFiles
    );
    rawImport.contextValue = treeItems.treeContext.RAW_IMPORTS;
    rawImports.push(rawImport);

    logUtils.sendOutputLogToChannel(
      `Starting check for package: ${rawImportName}`,
      logUtils.logType.INFO
    );

    // Check if import is available
    const cmd = cliCommands.getImportCmd(pythonInterpreterPath, rawImportName);
    const stdout = await cliCommands.safeRunCliCmd(
      [cmd],
      pythonInterpreterPath,
      true,
      true
    );

    // Convert to PyPi name if needed
    const packageName: string = _getPythonPackageFromUniquePythonPackageNames(rawImportName) ?? rawImportName;
    logUtils.sendOutputLogToChannel(
      `Package name after checking in unique dict names: ${packageName}`,
      logUtils.logType.INFO
    );

    // --- Package Classification ---
    if (!stdout) {
      // Installed Package
      const packageNumber = await getPythonPackageNumber(pythonInterpreterPath, packageName);
      if (packageNumber != null) {
        logUtils.sendOutputLogToChannel(
          `The Pip package: ${packageName} version is: ${packageNumber}`,
          logUtils.logType.INFO
        );
        const installedPythonPackage = new treeItems.pythonPackage(
          packageName,
          packageNumber,
          pythonInterpreterPath,
          pythonFiles
        );
        installedPythonPackage.contextValue = treeItems.treeContext.INSTALLED_PYTHON_PACKAGE;
        installedPythonPackages.push(installedPythonPackage);
      }
    } else if (
      stdout &&
      typeof stdout === 'object' &&
      JSON.stringify(stdout).includes('ModuleNotFoundError: No module named')
    ) {
      // Not installed, check if private or missing
      logUtils.sendOutputLogToChannel(
        `The Pip package: ${packageName} cannot be imported: "ModuleNotFoundError"`,
        logUtils.logType.INFO
      );
      const packageIsPrivateModule = projectInitFolders.includes(rawImportName);

      if (packageIsPrivateModule) {
        // Private Module
        logUtils.sendOutputLogToChannel(
          `The Pip package: ${rawImportName} seems to be a private module`,
          logUtils.logType.INFO
        );
        const privatePythonPackage = new treeItems.pythonPackage(
          rawImportName,
          null,
          pythonInterpreterPath,
          pythonFiles
        );
        privatePythonPackages.push(privatePythonPackage);

      } else {
        // Check if exists on PyPI
        const validPypiPackage = await checkPypiPackageExists(packageName);
        if (validPypiPackage) {
          // Missing Package
          logUtils.sendOutputLogToChannel(
            `The Pip package: ${packageName} found in Pypi website, considered as missing`,
            logUtils.logType.INFO
          );
          const missingPythonPackage = new treeItems.pythonPackage(
            packageName,
            null,
            pythonInterpreterPath,
            pythonFiles
          );
          missingPythonPackage.contextValue = treeItems.treeContext.MISSING_PYTHON_PACKAGE;
          missingPythonPackages.push(missingPythonPackage);

        } else {
          // Private (not on PyPI)
          logUtils.sendOutputLogToChannel(
            `The Pip package: ${packageName} cannot be found in Pypi website`,
            logUtils.logType.INFO
          );
          const privatePythonPackage = new treeItems.pythonPackage(
            packageName,
            null,
            pythonInterpreterPath,
            pythonFiles
          );
          privatePythonPackages.push(privatePythonPackage);
        }
      }
    }
  }

  // --- Collections Assembly ---

  // Installed
  if (installedPythonPackages.length > 0) {
    pythonPackageCollections.push(
      new treeItems.pythonPackageCollection(
        treeItems.pythonPackageCollectionName.INSTALLED,
        installedPythonPackages,
        installedPythonPackages[0].pythonInterpreterPath
      )
    );
  } else {
    const installedPythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.INSTALLED,
      [],
      undefined
    );
    installedPythonPackageCollection.contextValue = treeItems.treeContext.INSTALLED_PYTHON_PACKAGE_COLLECTION;
    pythonPackageCollections.push(installedPythonPackageCollection);
  }

  // Missing
  if (missingPythonPackages.length > 0) {
    const missingPythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.MISSING,
      missingPythonPackages,
      missingPythonPackages[0].pythonInterpreterPath
    );
    missingPythonPackageCollection.contextValue = treeItems.treeContext.MISSING_PYTHON_PACKAGE_COLLECTION;
    pythonPackageCollections.push(missingPythonPackageCollection);
  } else {
    const missingPythonPackageCollection = new treeItems.pythonPackageCollection(
      treeItems.pythonPackageCollectionName.MISSING,
      [],
      undefined
    );
    missingPythonPackageCollection.contextValue = treeItems.treeContext.MISSING_PYTHON_PACKAGE_COLLECTION;
    pythonPackageCollections.push(missingPythonPackageCollection);
  }

  // Private
  if (privatePythonPackages.length > 0) {
    pythonPackageCollections.push(
      new treeItems.pythonPackageCollection(
        treeItems.pythonPackageCollectionName.PRIVATE,
        privatePythonPackages,
        privatePythonPackages[0].pythonInterpreterPath
      )
    );
  } else {
    pythonPackageCollections.push(
      new treeItems.pythonPackageCollection(
        treeItems.pythonPackageCollectionName.PRIVATE,
        [],
        undefined
      )
    );
  }

  // Raw Imports
  if (rawImports.length > 0) {
    pythonPackageCollections.push(
      new treeItems.pythonPackageCollection(
        treeItems.pythonPackageCollectionName.RAW_IMPORTS,
        rawImports,
        rawImports[0].pythonInterpreterPath
      )
    );
  } else {
    pythonPackageCollections.push(
      new treeItems.pythonPackageCollection(
        treeItems.pythonPackageCollectionName.RAW_IMPORTS,
        [],
        undefined
      )
    );
  }

  // --- Return ---
  return pythonPackageCollections;
}



export async function getPythonPackageNumber(pythonInterpreterPath: string, pythonPackageName: string): Promise<string | null> {
  const pipShowCmd = cliCommands.getPipShowCmd(pythonPackageName);
  logUtils.sendOutputLogToChannel(`Show pip package command for ${pythonPackageName}: ${pipShowCmd}`, logUtils.logType.INFO);

  const stdout = await cliCommands.safeRunCliCmd([pipShowCmd], pythonInterpreterPath, false, true);
  try {
    return findVersion(stdout) || null;
  }
  catch (error) {
    return null
  }
}

export async function checkPypiPackageExists(packageName: string): Promise<boolean> {
  const url = `https://pypi.org/pypi/${packageName}/json`;
  return new Promise((resolve) => {
    const command = `curl -s -o /dev/null -w "%{http_code}" ${url}`;
    logUtils.sendOutputLogToChannel(`About to run cmd to checkPypiPackageExists. package name: ${packageName}. CMD: ${command}`, logUtils.logType.INFO);

    exec(command, (error, stdout) => {
      if (error) {
        resolve(false);
      } else {
        // PyPI API returns 404 for non-existent packages
        resolve(stdout.trim() === "200");
      }
    });
  });
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
  const validPypiPackage = await checkPypiPackageExists(pypiPackageName);
  if (!validPypiPackage) {
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
    let packageName = _getPythonPackageFromUniquePythonPackageNames(pipPackage.pipPackageName) ?? pipPackage.pipPackageName;
    logUtils.sendOutputLogToChannel(`Starting uninstalling: ${packageName}`, logUtils.logType.INFO)
    let unInstallPypiPackageCliCmd = cliCommands.getPipUnInstallCmd(packageName)
    let stdout = await cliCommands.safeRunCliCmd([unInstallPypiPackageCliCmd], pythonInterpreterPath, true, true)
    if (typeof stdout === 'string' && stdout.toLowerCase().includes('successfully')) {
      unInstalledPackages.push(packageName)
      logUtils.sendOutputLogToChannel(`Finished uninstalling: ${packageName}`, logUtils.logType.INFO)
    }
    else {
      logUtils.sendOutputLogToChannel(`Error uninstalling: ${pipPackage.pipPackageName}. Stdout is: ${stdout}`, logUtils.logType.INFO)
      vscode.window.showWarningMessage(`There was an error uninstalling: ${pipPackage.pipPackageName}, please review the extension logs for more info`)
    }
  }
  logUtils.sendOutputLogToChannel(`Finished uninstalling: ${unInstalledPackages.join(', ')}`, logUtils.logType.INFO)
}

function _getUniquePythonPackageNamesData(): Record<string, string> {
  let uniquePythonPackageNamesData: Record<string, string> = {}
  const uniquePythonPackageNamesFile = getUniquePythonPackageNamesFile();
  logUtils.sendOutputLogToChannel(`uniquePythonPackageNamesFile is: ${uniquePythonPackageNamesFile}`, logUtils.logType.INFO);
  // Getting default unique packages from const dict
  const defaultUniquePythonPackageNames: Record<string, string> = pipPackagesDict
  Object.assign(uniquePythonPackageNamesData, defaultUniquePythonPackageNames); // Merges the default data
  // Read the JSON file and parse it
  try {
    const rawData = fs.readFileSync(uniquePythonPackageNamesFile, 'utf8');
    const jsonDataFromFile = JSON.parse(rawData);
    logUtils.sendOutputLogToChannel(`Unique python package names from file are: ${JSON.stringify(jsonDataFromFile)}`, logUtils.logType.INFO);
    Object.assign(uniquePythonPackageNamesData, jsonDataFromFile); // Merges the parsed data
  } catch (error) {
    logUtils.sendOutputLogToChannel(`Error reading or parsing file: ${error}`, logUtils.logType.ERROR);
  }

  // Read the config settings and parse it
  const uniquePackagesFromConfig: Record<string, string> = extensionConfig.get('uniquePackages')
  if (uniquePackagesFromConfig) {
    logUtils.sendOutputLogToChannel(`Unique packages from config: ${JSON.stringify(uniquePackagesFromConfig)}`, logUtils.logType.INFO);
    Object.assign(uniquePythonPackageNamesData, uniquePackagesFromConfig); // Merge config values
  }
  return uniquePythonPackageNamesData
}


async function _installSelectedPackages(pythonInterpreterPath: string, selectedPackages: treeItems.pythonPackage[]) {
  const packagesToInstall = await _getPackagesToInstall(pythonInterpreterPath, selectedPackages);
  logUtils.sendOutputLogToChannel(`Pypi packages to install are: ${packagesToInstall.join(', ')}`, logUtils.logType.INFO)
  if (packagesToInstall.length > 0) {
    const searchSimilarPackages: boolean = extensionConfig.get('searchSimilarPackages')
    for (var packageToInstall of packagesToInstall) {
      if (searchSimilarPackages) {
        packageToInstall = await _handleSearchSimilarPackages(packageToInstall)
      }
      let InstallPypiPackageCliCmd = cliCommands.getPipInstallCmd(packageToInstall)
      let stdout = await cliCommands.safeRunCliCmd([InstallPypiPackageCliCmd], pythonInterpreterPath, true, true)
      if (typeof stdout === 'string' && stdout.toLowerCase().includes('successfully')) {
        logUtils.sendOutputLogToChannel(`Finished installing: ${packageToInstall}`, logUtils.logType.INFO)
      }
      else {
        logUtils.sendOutputLogToChannel(`There was an error installing: ${packageToInstall}, please review the extension logs for more info`, logUtils.logType.WARNING)
      }
    }
  }
}

export async function updatePackage(pythonPackage: treeItems.pythonPackage) {
  _updateSelectedPackages(pythonPackage.pythonInterpreterPath, [pythonPackage])
}

async function _updateSelectedPackages(pythonInterpreterPath: string, selectedPackages: treeItems.pythonPackage[]) {
  logUtils.sendOutputLogToChannel(`Got a request to update following Pypi packages: ${selectedPackages.join(', ')}`, logUtils.logType.INFO)
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
      packageToUpdate = _getPythonPackageFromUniquePythonPackageNames(packageToUpdate) ?? packageToUpdate
      let pipUpgradeCmd = cliCommands.getPipUpgradeCmd(packageToUpdate)
      let stdout = await cliCommands.safeRunCliCmd([pipUpgradeCmd], pythonInterpreterPath, true, true)
      if (typeof stdout === 'string' && stdout.toLowerCase().includes('successfully')) {
        logUtils.sendOutputLogToChannel(`Finished updating: ${packageToUpdate}`, logUtils.logType.INFO)
        updatedPackages.push(packageToUpdate)
      }
      else {
        logUtils.sendOutputLogToChannel(`There was an error updating: ${packageToUpdate}, stdout is: ${stdout}`, logUtils.logType.WARNING)
      }
    }
    logUtils.sendOutputLogToChannel(`Successfully updated python packages: ${updatedPackages.join(', ')}`, logUtils.logType.INFO)
  }

  if (packagesCannotUpdate.length > 0) {
    logUtils.sendOutputLogToChannel(`Unable to update python packages: ${packagesCannotUpdate.join(', ')}, packages cannot be imported`, logUtils.logType.WARNING)
  }
}

export async function installRequirementFile(folderView: treeItems.FoldersView) {
  _validateInterpreterSet(folderView);
  const requirementFilePath = await getUserInput(
    'Please provide a full path to the requirement.txt file',
    undefined, true, 'Path cannot be empty'
  )
  if (fs.existsSync(requirementFilePath)!) {
    logUtils.sendOutputLogToChannel(`Unable to find requirement.txt file on path: ${requirementFilePath}`, logUtils.logType.ERROR)
    vscode.window.showErrorMessage(`The provided file path cannot be found: ${requirementFilePath}. Please verify file location on the system`)
    return
  }
  await _runInstallRequirementFile(requirementFilePath, folderView.pythonInterpreterPath)
}

function _validateInterpreterSet(folderView: treeItems.FoldersView) {
  if (!folderView.pythonInterpreterPath) {
    throw new Error(`${folderView.folderName} does not have a Python Interpreter set. Please set one, and then run scan for folder`);
  }
}

async function _runInstallRequirementFile(requirementFilePath: string, pythonInterpreterPath: string) {
  const pipInstallRequirementFileCmd = cliCommands.getPipInstallRequirementFileCmd(requirementFilePath)
  await cliCommands.safeRunCliCmd([pipInstallRequirementFileCmd], pythonInterpreterPath, true)
  logUtils.sendOutputLogToChannel(`Finished running installation for requirement file: ${requirementFilePath}, please review extension logs for more info`, logUtils.logType.INFO)
}

export async function scanInstallRequirementsFile(folderView: treeItems.FoldersView) {
  _validateInterpreterSet(folderView);
  const normalizedWorkspace = folderView.folderFsPath.replace(/\\/g, '/');
  const projectRequirementsFiles = await promiseGlob(`${normalizedWorkspace}/**/requirements.txt`);
  if (projectRequirementsFiles.length === 0) {
    logUtils.sendOutputLogToChannel(`Unable to find requirements.txt files in your project`, logUtils.logType.INFO)
    vscode.window.showWarningMessage(`Unable to find requirements.txt files in your project. Not running any action`)
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
        logUtils.sendOutputLogToChannel(`Folder interpreter selection canceled for: ${folder.filePath}`, logUtils.logType.WARNING)
      }
    }
    else {
      logUtils.sendOutputLogToChannel(`user quick pick chosen item for python path is: ${JSON.stringify(userQuickPick, undefined, 4)}`, logUtils.logType.INFO)
      chosenPythonInterpreter = userQuickPick.description
    }
  }
  if (!chosenPythonInterpreter) {
    logUtils.sendOutputLogToChannel(`No python interpreter was chosen for: ${folder.filePath}`, logUtils.logType.WARNING)
  }
  return chosenPythonInterpreter
}

async function _searchSimilarPackages(pipPackageName: string): Promise<string[]> {
  const foundSimilarPackages: string[] = [];
  let pageNumber = 1;

  do {
    const searchSimilarPackagesCmd = cliCommands.getPipSearchSimilarPackagesCmd(pipPackageName, pageNumber);
    try {
      const stdout = cp.execSync(searchSimilarPackagesCmd, { encoding: 'utf-8' });
      if (stdout && stdout.includes('package-snippet__name')) {
        const matches = stdout.match(/<span class="package-snippet__name">([^<]+)<\/span>/g) || [];
        const extractedStrings = matches.map(match => match.replace(/<[^>]+>/g, '').trim());
        if (extractedStrings.length > 0) {
          foundSimilarPackages.push(...extractedStrings);
          pageNumber++;
        } else {
          break;
        }
      } else {
        break;
      }
    } catch (error) {
      break; // Exit loop on error
    }
  } while (true);

  return foundSimilarPackages;
}

function _getPythonPackageFromUniquePythonPackageNames(pipPackageName: string): string | null {
  const UniquePythonPackageNamesData = _getUniquePythonPackageNamesData()
  const value = UniquePythonPackageNamesData[pipPackageName] ?? null;
  return value
}

export async function _handleSearchSimilarPackages(pipPackageName: string): Promise<string> {
  // Trying to check if we have the name already in unique python package names
  let uniquePythonPackageName = _getPythonPackageFromUniquePythonPackageNames(pipPackageName)
  if (uniquePythonPackageName) {
    return uniquePythonPackageName
  }

  // Search for similar packages (example async operation)
  const foundSimilarPackages = await _searchSimilarPackages(pipPackageName);

  if (foundSimilarPackages.length > 0) {
    // Create QuickPick options
    const options: vscode.QuickPickItem[] = foundSimilarPackages.map((pkg, index) => ({
      label: `${index + 1}`,
      description: pkg
    }));

    // Show QuickPick and await user selection
    const userQuickPick = await vscode.window.showQuickPick(options, {
      canPickMany: false,
      placeHolder: 'Please select a python package to install from the list',
      matchOnDescription: true
    });

    if (userQuickPick) {
      vscode.window.showInformationMessage(`User selected: ${userQuickPick.description}`);
      logUtils.sendOutputLogToChannel(`updating user preference: ${pipPackageName} as: ${userQuickPick.description}, in mapping file`, logUtils.logType.INFO)
      addToUniquePythonPackageNames(pipPackageName, userQuickPick.description);
      return userQuickPick.description; // Return the selected package description
    } else {
      vscode.window.showInformationMessage('User did not select any option.');
      return pipPackageName; // Return the input package name if no selection is made
    }
  }

  // If no similar packages are found, return the input package name
  return pipPackageName;
}


function addToUniquePythonPackageNames(key: string, value: string): void {
  const uniquePythonPackageNamesFile = getUniquePythonPackageNamesFile();
  // Read existing data from the file
  let data: Record<string, string> = {};
  if (fs.existsSync(uniquePythonPackageNamesFile)) {
    const rawData = fs.readFileSync(uniquePythonPackageNamesFile, 'utf8');
    try {
      data = JSON.parse(rawData);
    } catch (error) {
      console.error('Error parsing JSON file:', error);
    }
  }

  // Update the key-value pair
  data[key] = value;

  // Write the updated data back to the file
  fs.writeFileSync(uniquePythonPackageNamesFile, JSON.stringify(data, null, 2), 'utf8');
}

export async function openPythonFile(filePath: string) {
  const fileUri = vscode.Uri.file(filePath);
  const exists = fs.existsSync(filePath);

  if (!exists) {
    vscode.window.showErrorMessage(`File not found: ${filePath}`);
    return;
  }

  const document = await vscode.workspace.openTextDocument(fileUri);
  await vscode.window.showTextDocument(document);
}