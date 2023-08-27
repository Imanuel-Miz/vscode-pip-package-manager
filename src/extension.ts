import vscode from 'vscode';
import { PipPackageManagerProvider } from './treeView/pipPackageManagerTree';
import * as treeViewUtils from './utils/treeViewUtils';


function activate(context: vscode.ExtensionContext) {

	// Init tree from saved data
	const savedDataJson = context.workspaceState.get<string>('treeViewData');
	const savedData = savedDataJson ? JSON.parse(savedDataJson) : { name: '', collapsibleState: vscode.TreeItemCollapsibleState.None };
	const PipPackageManagerProviderTree = new PipPackageManagerProvider(savedData, context);
	vscode.window.registerTreeDataProvider('pipPackageManager', PipPackageManagerProviderTree);

	// Folder commands
	vscode.commands.registerCommand('pip-package-manager.refreshFolders', () => PipPackageManagerProviderTree.refreshFolders());
	vscode.commands.registerCommand('pip-package-manager.refreshFolder', (folder) => PipPackageManagerProviderTree.refreshPackages(folder));
	vscode.commands.registerCommand('pip-package-manager.setFolderInterpreter', async (folder) => await PipPackageManagerProviderTree.setFolderInterpreter(folder));
	vscode.commands.registerCommand('pip-package-manager.showFolderMetadata', async (folder) => await PipPackageManagerProviderTree.showFolderMetadata(folder));
	// Installation commands
	vscode.commands.registerCommand('pip-package-manager.installMissingPackages', async (pythonPackageCollection) => await treeViewUtils.installMissingPackages(pythonPackageCollection));
	vscode.commands.registerCommand('pip-package-manager.installPackages', async (pythonPackage) => await treeViewUtils.installPackage(pythonPackage));
	vscode.commands.registerCommand('pip-package-manager.installPypiPackage', async (folder) => await treeViewUtils.installPypiPackage(folder));
	vscode.commands.registerCommand('pip-package-manager.updatePackage', async (pythonPackage) => await treeViewUtils.updatePackage(pythonPackage));
	vscode.commands.registerCommand('pip-package-manager.unInstallPypiPackage', async (pythonPackage) => await treeViewUtils.unInstallPypiPackage(pythonPackage));
	// requirements commands
	vscode.commands.registerCommand('pip-package-manager.installRequirementFile', async (folder) => await treeViewUtils.installRequirementFile(folder));
	vscode.commands.registerCommand('pip-package-manager.scanInstallRequirementsFile', async (folder) => await treeViewUtils.scanInstallRequirementsFile(folder));

	// Save treeview once extension exist
	context.subscriptions.push(vscode.commands.registerCommand('pip-package-manager.deactivate', () => {
		// Update and save data
		PipPackageManagerProviderTree.updateAndSaveData();
	}));

}

module.exports = {
	activate
}