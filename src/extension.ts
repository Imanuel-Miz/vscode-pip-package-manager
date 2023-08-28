import vscode from 'vscode';
import { PipPackageManagerProvider } from './treeView/pipPackageManagerTree';
import * as treeViewUtils from './utils/treeViewUtils';
let PipPackageManagerProviderTree: PipPackageManagerProvider | undefined = undefined;


function registerTreeView(context: vscode.ExtensionContext) {
	if (!PipPackageManagerProviderTree) {
		const savedDataJson = context.workspaceState.get<string>('treeViewData');
		const savedData = savedDataJson ? JSON.parse(savedDataJson) : { name: '', collapsibleState: vscode.TreeItemCollapsibleState.None };
		PipPackageManagerProviderTree = new PipPackageManagerProvider(savedData, context);
		vscode.window.registerTreeDataProvider('pipPackageManager', PipPackageManagerProviderTree);
	}
}

function activate(context: vscode.ExtensionContext) {

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
function deactivate() {
	if (PipPackageManagerProviderTree) {
		PipPackageManagerProviderTree.updateAndSaveData()
	}
}

module.exports = {
	registerTreeView, activate, deactivate
}