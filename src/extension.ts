import vscode from 'vscode';
import { PipPackageManagerProvider } from './treeView/pipPackageManagerTree';
import * as treeViewUtils from './utils/treeViewUtils';
import * as logUtils from './utils/logUtils';
import path from 'path'
import fs from 'fs'
export const treeViewDataFileName = 'pipPackageManagerTreeData.json';

function registerTreeView(context: vscode.ExtensionContext): PipPackageManagerProvider {
	const dataFilePath = path.join(context.extensionPath, treeViewDataFileName);
	let treeViewData = { name: '', collapsibleState: vscode.TreeItemCollapsibleState.None };

	const logInfo = (message: string) => {
		logUtils.sendOutputLogToChannel(message, logUtils.logType.INFO);
	};

	if (fs.existsSync(dataFilePath)) {
		logInfo(`Checking for previous tree view data`);
		logInfo(`tree view data exists, loading tree view data`);
		const savedData = fs.readFileSync(dataFilePath, 'utf-8');
		logInfo(`savedData: ${savedData}`);
		treeViewData = JSON.parse(savedData);
	}
	const PipPackageManagerProviderTree = new PipPackageManagerProvider(treeViewData, context);
	vscode.window.registerTreeDataProvider('pipPackageManager', PipPackageManagerProviderTree);
	return PipPackageManagerProviderTree
}

function activate(context: vscode.ExtensionContext) {
	logUtils.sendOutputLogToChannel(`triggered activate`, logUtils.logType.INFO);
	const PipPackageManagerProviderTree = registerTreeView(context);
	PipPackageManagerProviderTree.updateAndSaveData();

	const commands = [
		// Folder commands
		{ command: 'pip-package-manager.refreshFolders', callback: () => PipPackageManagerProviderTree.refreshFolders() },
		{ command: 'pip-package-manager.refreshFolder', callback: (folder) => PipPackageManagerProviderTree.refreshPackages(folder) },
		{ command: 'pip-package-manager.setFolderInterpreter', callback: async (folder) => await PipPackageManagerProviderTree.setFolderInterpreter(folder) },
		{ command: 'pip-package-manager.showFolderMetadata', callback: async (folder) => await PipPackageManagerProviderTree.showFolderMetadata(folder) },
		// Installation commands 
		{ command: 'pip-package-manager.installMissingPackages', callback: async (pythonPackageCollection) => await treeViewUtils.installMissingPackages(pythonPackageCollection) },
		{ command: 'pip-package-manager.installPackages', callback: async (pythonPackage) => await treeViewUtils.installPackage(pythonPackage) },
		{ command: 'pip-package-manager.installPypiPackage', callback: async (folder) => await treeViewUtils.installPypiPackage(folder) },
		{ command: 'pip-package-manager.updatePackage', callback: async (pythonPackage) => await treeViewUtils.updatePackage(pythonPackage) },
		{ command: 'pip-package-manager.unInstallPypiPackage', callback: async (pythonPackage) => await treeViewUtils.unInstallPypiPackage(pythonPackage) },
		// requirements commands
		{ command: 'pip-package-manager.installRequirementFile', callback: async (folder) => await treeViewUtils.installRequirementFile(folder) },
		{ command: 'pip-package-manager.scanInstallRequirementsFile', callback: async (folder) => await treeViewUtils.scanInstallRequirementsFile(folder) },
	];
	// Register commands
	commands.forEach(({ command, callback }) => vscode.commands.registerCommand(command, callback));

}

// Save tree provider data once closing vscode
function deactivate(context: vscode.ExtensionContext) {
	const dataFilePath = path.join(context.extensionPath, treeViewDataFileName);
	fs.unlinkSync(dataFilePath);
}

module.exports = {
	activate, deactivate
}