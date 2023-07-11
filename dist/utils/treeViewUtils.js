"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePackage = exports.installPypiPackage = exports.installPackage = exports.installMissingPackages = exports.getUserInput = exports.findVersion = exports.extractVersion = exports.checkUrlExists = exports.getPythonPackageNumber = exports.getPythonPackageCollections = exports.scanProjectDependencies = exports.getProjectDependencies = exports.getProjectPythonFiles = exports.getPythonPackageCollectionsForFolder = exports.getWorkspaceFoldersOnly = exports.enrichInfoFromPythonExtension = exports.updateConfiguration = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs-extra"));
const glob = __importStar(require("glob"));
const cp = __importStar(require("child_process"));
const axios_1 = __importDefault(require("axios"));
const treeItems = __importStar(require("../treeView/TreeItems"));
const extensionConfig = vscode.workspace.getConfiguration('pipPackageManager');
const followSymbolicLinks = extensionConfig.get('followSymbolicLinks');
function updateConfiguration(configSetting, configValue) {
    extensionConfig.update(configSetting, configValue, vscode.ConfigurationTarget.Workspace);
}
exports.updateConfiguration = updateConfiguration;
function checkFolderForPyFiles(folderPath) {
    const pythonFiles = glob.sync(`${folderPath}/**/*.py`);
    return pythonFiles.length > 0;
}
function enrichInfoFromPythonExtension(folderViews, pythonExtensionConfig) {
    folderViews.forEach((folderView) => {
        console.log(`iconPath is: ${JSON.stringify(folderView.iconPath, undefined, 4)}`);
        for (let key in pythonExtensionConfig.exports.environments["known"]) {
            let env_info = pythonExtensionConfig.exports.environments["known"][key];
            try {
                if (env_info["internal"]["environment"]["workspaceFolder"]["name"] === folderView.folderName) {
                    folderView.folderVenv = env_info["internal"]["path"];
                }
            }
            catch (error) {
                vscode.window.showErrorMessage(`Unable to find folder data for ${folderView.folderName}, please try to attach Venv / Python interpreter manually`);
                continue;
            }
        }
    });
}
exports.enrichInfoFromPythonExtension = enrichInfoFromPythonExtension;
function getWorkspaceFoldersOnly(folderViews) {
    vscode.workspace.workspaceFolders.forEach((folder) => {
        let folderHasPythonFiles = checkFolderForPyFiles(folder.uri.fsPath);
        if (folderHasPythonFiles) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(folder.uri);
            let folderView = new treeItems.FoldersView(workspaceFolder.name, null, folder.uri.fsPath, vscode.TreeItemCollapsibleState.Collapsed);
            folderViews.push(folderView);
        }
        else {
            console.log(`Folder ${folder.uri.fsPath} does not include python files`);
        }
    });
    return folderViews;
}
exports.getWorkspaceFoldersOnly = getWorkspaceFoldersOnly;
async function getPythonPackageCollectionsForFolder(folderView) {
    if (!folderView.folderVenv) {
        vscode.window.showErrorMessage(`${folderView.folderName} does not have a Python Interpreter set. Please set one, and then run scan for folder`);
        return;
    }
    let ProjectDependencies = await getProjectDependencies(folderView.folderFsPath);
    let projectInitFolders = await getProjectInitFolders(folderView.folderFsPath);
    let PythonPackageCollections = await getPythonPackageCollections(ProjectDependencies, folderView.folderVenv, projectInitFolders);
    return PythonPackageCollections;
}
exports.getPythonPackageCollectionsForFolder = getPythonPackageCollectionsForFolder;
function extractParentFolder(path) {
    const folders = path.split("/");
    const lastFolder = folders[folders.length - 2];
    return lastFolder;
}
async function getProjectInitFolders(workspaceFolder) {
    const initPyFolders = new Set();
    // Read the contents of the directory
    const pythonInitFolders = glob.sync(`${workspaceFolder}/**/__init__.py`, { follow: followSymbolicLinks });
    // Check each file in the directory
    pythonInitFolders.forEach(async (folder) => {
        let initPyFolder = extractParentFolder(folder);
        initPyFolders.add(initPyFolder);
    });
    return Array.from(initPyFolders);
}
async function getProjectPythonFiles(workspaceFolder) {
    const pythonFiles = glob.sync(`${workspaceFolder}/**/*.py`, { follow: followSymbolicLinks });
    return pythonFiles;
}
exports.getProjectPythonFiles = getProjectPythonFiles;
async function getProjectDependencies(workspaceFolder) {
    let ProjectPythonFiles = await getProjectPythonFiles(workspaceFolder);
    let ProjectDependencies = await scanProjectDependencies(ProjectPythonFiles);
    return ProjectDependencies;
}
exports.getProjectDependencies = getProjectDependencies;
async function scanProjectDependencies(ProjectPythonFiles) {
    const importedPackages = new Set();
    for (const file of ProjectPythonFiles) {
        const contents = fs.readFileSync(file, 'utf-8');
        const matches = contents.matchAll(/(?:^from|^import) ([a-zA-Z0-9_]+)(?:.*)/gm);
        for (const match of matches) {
            importedPackages.add(match[1]);
        }
    }
    return Array.from(importedPackages);
}
exports.scanProjectDependencies = scanProjectDependencies;
async function getPythonPackageCollections(ProjectDependencies, folderVenv, projectInitFolders) {
    const pythonPackageCollections = [];
    const installedPythonPackages = [];
    const missingPythonPackages = [];
    const privatePythonPackages = [];
    console.log(`Starting get package collections`);
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
                    const privatePythonPackage = new treeItems.pythonPackage(packageName, null, folderVenv);
                    privatePythonPackages.push(privatePythonPackage);
                }
                else {
                    const validUrl = await checkUrlExists(`https://pypi.org/project/${packageName}/`);
                    if (validUrl) {
                        const missingPythonPackage = new treeItems.pythonPackage(packageName, null, folderVenv);
                        missingPythonPackage.contextValue = 'missingPythonPackage';
                        missingPythonPackages.push(missingPythonPackage);
                    }
                    else {
                        const privatePythonPackage = new treeItems.pythonPackage(packageName, null, folderVenv);
                        privatePythonPackages.push(privatePythonPackage);
                    }
                }
            }
        }
        const packageNumber = await getPythonPackageNumber(packageName);
        const installedPythonPackage = new treeItems.pythonPackage(packageName, packageNumber, folderVenv);
        installedPythonPackage.contextValue = 'installedPythonPackage';
        installedPythonPackages.push(installedPythonPackage);
    }
    if (installedPythonPackages.length > 0) {
        const installedPythonPackageCollection = new treeItems.pythonPackageCollection(treeItems.pythonPackageCollectionName.INSTALLED, installedPythonPackages, installedPythonPackages[0].folderVenv);
        pythonPackageCollections.push(installedPythonPackageCollection);
    }
    if (missingPythonPackages.length > 0) {
        const missingPythonPackageCollection = new treeItems.pythonPackageCollection(treeItems.pythonPackageCollectionName.MISSING, missingPythonPackages, missingPythonPackages[0].folderVenv);
        missingPythonPackageCollection.contextValue = 'missingPythonPackageCollection';
        pythonPackageCollections.push(missingPythonPackageCollection);
    }
    if (privatePythonPackages.length > 0) {
        const privatePythonPackageCollection = new treeItems.pythonPackageCollection(treeItems.pythonPackageCollectionName.PRIVATE, privatePythonPackages, privatePythonPackages[0].folderVenv);
        pythonPackageCollections.push(privatePythonPackageCollection);
    }
    return pythonPackageCollections;
}
exports.getPythonPackageCollections = getPythonPackageCollections;
async function getPythonPackageNumber(pythonPackageName) {
    const cmd = `pip show ${pythonPackageName}`;
    console.log(`About to run show pip for package: ${pythonPackageName}`);
    try {
        let stdout = cp.execSync(cmd, { encoding: 'utf-8' });
        let packageVersion = findVersion(stdout);
        console.log(`packageVersion is: ${packageVersion}`);
        return packageVersion;
    }
    catch (error) {
        return null;
    }
}
exports.getPythonPackageNumber = getPythonPackageNumber;
async function checkUrlExists(url) {
    try {
        const response = await axios_1.default.head(url);
        return response.status === 200;
    }
    catch (error) {
        return false;
    }
}
exports.checkUrlExists = checkUrlExists;
function extractVersion(line) {
    const versionRegex = /^Version:\s+(.*)/i;
    const match = line.match(versionRegex);
    if (match && match[1]) {
        return match[1];
    }
    return null;
}
exports.extractVersion = extractVersion;
function findVersion(multiLineString) {
    const lines = multiLineString.split('\n');
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('Version')) {
            return extractVersion(trimmedLine);
        }
    }
    return null;
}
exports.findVersion = findVersion;
async function getUserInput(prompt, placeHolder, validateInput, inputErrorMessage) {
    if (validateInput && !inputErrorMessage) {
        throw new Error('Asked to validate input without inputErrorMessage');
    }
    const inputBoxOptions = {
        placeHolder: placeHolder,
    };
    if (prompt) {
        inputBoxOptions.prompt = prompt;
    }
    else {
        inputBoxOptions.prompt = 'Please enter your input here';
    }
    if (validateInput) {
        inputBoxOptions.validateInput = (input) => {
            if (!input) {
                return inputErrorMessage;
            }
            return null;
        };
    }
    const userInput = await vscode.window.showInputBox(inputBoxOptions);
    return userInput;
}
exports.getUserInput = getUserInput;
function getActivePythonPath(pythonInterpreterPath) {
    const wordsToReplace = ["python", "python3"];
    const pattern = new RegExp(wordsToReplace.join("|"), "g");
    const replacedPath = pythonInterpreterPath.replace(pattern, "activate");
    return replacedPath;
}
async function installMissingPackages(pythonPackageCollection) {
    _installSelectedPackages(pythonPackageCollection.folderVenv, pythonPackageCollection.pythonPackages);
}
exports.installMissingPackages = installMissingPackages;
async function installPackage(pythonPackage) {
    _installSelectedPackages(pythonPackage.folderVenv, [pythonPackage]);
}
exports.installPackage = installPackage;
async function installPypiPackage(folderView) {
    if (!folderView.folderVenv) {
        vscode.window.showErrorMessage(`${folderView.folderName} does not have a Python Interpreter set. Please set one, and then run scan for folder`);
        return;
    }
    const pypiPackageName = await getUserInput('Please provide Pypi package name', 'Example: mangum', true, 'Pypi package cannot be empty');
    vscode.window.showInformationMessage(`Checking ${pypiPackageName} is a valid Pypi package`);
    const validUrl = await checkUrlExists(`https://pypi.org/project/${pypiPackageName}/`);
    if (!validUrl) {
        vscode.window.showErrorMessage(`${pypiPackageName} is not a valid package name`);
        return;
    }
    const pypiPackageVersion = await getUserInput('Please provide the desired Pypi package version', 'Example: 0.17.0', false);
    if (!pypiPackageVersion) {
        vscode.window.showWarningMessage(`No version was provided for ${pypiPackageName} will install the latest version`);
    }
    _installPypiPackageTerminal(folderView.folderVenv, pypiPackageName, pypiPackageVersion);
}
exports.installPypiPackage = installPypiPackage;
function _installPypiPackageTerminal(folderVenv, pypiPackageName, pypiPackageVersion) {
    let installSyntax = `pip3 install ${pypiPackageName}`;
    if (pypiPackageVersion) {
        installSyntax += `==${pypiPackageVersion}`;
    }
    const activePythonPath = getActivePythonPath(folderVenv);
    const terminal = vscode.window.createTerminal();
    terminal.sendText(`source ${activePythonPath}`);
    terminal.sendText(installSyntax);
}
function _installSelectedPackages(folderVenv, selectedPackages) {
    const activePythonPath = getActivePythonPath(folderVenv);
    const packagesToInstall = [];
    const installedPackages = [];
    for (var pythonPackage of selectedPackages) {
        const cmd = `${folderVenv} -c "import ${pythonPackage.pipPackageName}"`;
        try {
            cp.execSync(cmd, { encoding: 'utf-8' });
        }
        catch (error) {
            packagesToInstall.push(pythonPackage.pipPackageName);
        }
    }
    if (packagesToInstall.length > 0) {
        const terminal = vscode.window.createTerminal();
        terminal.sendText(`source ${activePythonPath}`);
        for (var packageToInstall of packagesToInstall) {
            terminal.sendText(`pip3 install ${packageToInstall}`);
            installedPackages.push(packageToInstall);
        }
    }
    vscode.window.showInformationMessage(`Successfully installed python packages: ${installedPackages.join(', ')}`);
}
async function updatePackage(pythonPackage) {
    _updateSelectedPackages(pythonPackage.folderVenv, [pythonPackage]);
}
exports.updatePackage = updatePackage;
function _updateSelectedPackages(folderVenv, selectedPackages) {
    const activePythonPath = getActivePythonPath(folderVenv);
    const packagesCannotUpdate = [];
    const packagesToUpdate = [];
    const updatedPackages = [];
    for (var pythonPackage of selectedPackages) {
        const cmd = `${folderVenv} -c "import ${pythonPackage.pipPackageName}"`;
        try {
            cp.execSync(cmd, { encoding: 'utf-8' });
            packagesToUpdate.push(pythonPackage.pipPackageName);
        }
        catch (error) {
            packagesCannotUpdate.push(pythonPackage.pipPackageName);
        }
    }
    if (packagesToUpdate.length > 0) {
        const terminal = vscode.window.createTerminal();
        terminal.sendText(`source ${activePythonPath}`);
        for (var packageToInstall of packagesToUpdate) {
            terminal.sendText(`pip3 install --upgrade ${packageToInstall}`);
            updatedPackages.push(packageToInstall);
        }
    }
    vscode.window.showInformationMessage(`Successfully updated python packages: ${updatedPackages.join(', ')}`);
    if (packagesCannotUpdate.length > 0) {
        vscode.window.showWarningMessage(`Unable to updated python packages: ${packagesCannotUpdate.join(', ')}`);
    }
}
//# sourceMappingURL=treeViewUtils.js.map