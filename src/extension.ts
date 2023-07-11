import vscode from 'vscode';
import { PipPackageManagerProvider } from './treeView/pipPackageManagerTree';
import * as treeViewUtils from './utils/treeViewUtils';

/**
 * @param {vscode.ExtensionContext} context
 */


function activate(context: any) {

	const PipPackageManagerProviderTree = new PipPackageManagerProvider();
	vscode.window.registerTreeDataProvider('pipPackageManager', PipPackageManagerProviderTree);
	vscode.commands.registerCommand('pip-package-manager.refreshFolders', () => PipPackageManagerProviderTree.refreshFolders());
	vscode.commands.registerCommand('pip-package-manager.refreshFolder', (folder) => PipPackageManagerProviderTree.refreshPackages(folder));
	vscode.commands.registerCommand('pip-package-manager.setFolderInterpreter', async (folder) => await PipPackageManagerProviderTree.setFolderInterpreter(folder));
	vscode.commands.registerCommand('pip-package-manager.installMissingPackages', async (pythonPackageCollection) => await treeViewUtils.installMissingPackages(pythonPackageCollection));
	vscode.commands.registerCommand('pip-package-manager.installPackages', async (pythonPackage) => await treeViewUtils.installPackage(pythonPackage));
	vscode.commands.registerCommand('pip-package-manager.installPypiPackage', async (folder) => await treeViewUtils.installPypiPackage(folder));
	vscode.commands.registerCommand('pip-package-manager.updatePackage', async (pythonPackage) => await treeViewUtils.updatePackage(pythonPackage));

}
module.exports = {
	activate
}