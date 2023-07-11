// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
import { PipPackageManagerProvider } from './pip_package_manager_tree'
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "pip-package-manager" is now active!');
	const PipPackageManagerProviderTree = new PipPackageManagerProvider();
	vscode.window.registerTreeDataProvider('pipPackageManager', PipPackageManagerProviderTree);
	
	
	
	let disposable = vscode.commands.registerCommand('pip-package-manager.getPythonEnvs', function () {
		if (!vscode.workspace.workspaceFolders) {
			vscode.workspace.workspaceFolders.forEach((folder) => {
				const pythonFolderUri = vscode.workspace.getConfiguration('ms-python.python');
				vscode.window.showInformationMessage(`Python path found is: ${pythonFolderUri}`);
				const pythonPath = pythonFolderUri.get('pythonPath');
				vscode.window.showInformationMessage(`Python path found is: ${pythonPath}`);
				if (pythonPath) {
					console.log(`Python virtual environment for ${folder.name} : ${pythonPath}`);
				} else {
					console.log(`No Python virtual environment is set for ${folder.name}`);
				}
			});
		}
});

let viewCommand = vscode.commands.registerCommand('pip-package-manager.listPythonEnvs', function () {
})
	
    context.subscriptions.push(disposable, viewCommand);
}
module.exports = {
	activate
}