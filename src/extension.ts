import vscode from 'vscode';
import { PipPackageManagerProvider } from './treeView/pipPackageManagerTree';
import * as treeViewUtils from './utils/treeViewUtils';
import * as logUtils from './utils/logUtils';
import { runWithProgress } from './utils/operationUtils';

function activate() {
	logUtils.sendOutputLogToChannel(`Pip Package Manager is now active!`, logUtils.logType.INFO);
	const PipPackageManagerProviderTree = new PipPackageManagerProvider();
	vscode.window.registerTreeDataProvider('pipPackageManager', PipPackageManagerProviderTree);

	const commands = [
		// Folder commands
		{ command: 'pip-package-manager.refreshFolders', callback: () => PipPackageManagerProviderTree.refreshFolders() },
		{ command: 'pip-package-manager.refreshFolder', callback: (folder) => PipPackageManagerProviderTree.refreshPackages(folder) },
		{ command: 'pip-package-manager.setFolderInterpreter', callback: async (folder) => await PipPackageManagerProviderTree.setFolderInterpreter(folder) },
		{ command: 'pip-package-manager.showFolderMetadata', callback: async (folder) => await PipPackageManagerProviderTree.showFolderMetadata(folder) },
		// Installation commands 
		{ command: 'pip-package-manager.installMissingPackages', callback: async (pythonPackageCollection) => runWithProgress(treeViewUtils.installMissingPackages(pythonPackageCollection), 'Installing missing packages') },
		{ command: 'pip-package-manager.installPackages', callback: async (pythonPackage) => runWithProgress(treeViewUtils.installPackage(pythonPackage), `Installing ${pythonPackage.packageName}`) },
		{ command: 'pip-package-manager.installPypiPackage', callback: async (folder) => await treeViewUtils.installPypiPackage(folder) },
		{ command: 'pip-package-manager.updatePackage', callback: async (pythonPackage) => runWithProgress(treeViewUtils.updatePackage(pythonPackage), `Updating ${pythonPackage.packageName}`) },
		{ command: 'pip-package-manager.unInstallPypiPackage', callback: async (pythonPackage) => runWithProgress(treeViewUtils.unInstallPypiPackage(pythonPackage), `Uninstalling ${pythonPackage.packageName}`) },
		// requirements commands
		{ command: 'pip-package-manager.installRequirementFile', callback: async (folder) => runWithProgress(treeViewUtils.installRequirementFile(folder), 'Installing requirement file') },
		{ command: 'pip-package-manager.scanInstallRequirementsFile', callback: async (folder) => runWithProgress(treeViewUtils.scanInstallRequirementsFile(folder), `Scanning and installing requirement files for ${folder.folderName}`) },
	];
	// Register commands
	commands.forEach(({ command, callback }) => vscode.commands.registerCommand(command, callback));


}


module.exports = {
	activate
}