import * as vscode from 'vscode';
import * as treeItems from './TreeItems'
import * as treeViewUtils from '../utils/treeViewUtils'
import * as validator from '../utils/validator'

export class PipPackageManagerProvider implements vscode.TreeDataProvider<treeItems.BaseFoldersView> {

  private _onDidChangeTreeData: vscode.EventEmitter<treeItems.BaseFoldersView | undefined | void> = new vscode.EventEmitter<treeItems.BaseFoldersView | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<treeItems.BaseFoldersView | undefined | void> = this._onDidChangeTreeData.event;

  refreshFolders(): void {
    this._onDidChangeTreeData.fire();
  }

  refreshPackages(folder: treeItems.FoldersView): void {
    this._onDidChangeTreeData.fire(folder);
  }

  async setFolderInterpreter(folder: treeItems.FoldersView,): Promise<void> {
    const folderInterpreterFromUser = await treeViewUtils.getUserInput(
      'Please enter a valid Python interpreter path',
      'Example: /user/local/bin/python',
      true,
      'Python interpreter cannot be empty'
    )
    const isValid = validator.isValidInterpreterPath(folderInterpreterFromUser)
    if (isValid) {
      folder.folderVenv = folderInterpreterFromUser
      this._onDidChangeTreeData.fire(folder);
      vscode.window.showInformationMessage(`${folder.folderName} was updated successfully with Python Interpreter: ${folderInterpreterFromUser}`)
    }
  }

  getTreeItem(element: treeItems.BaseFoldersView): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: treeItems.BaseFoldersView): Promise<treeItems.BaseFoldersView[]> {
    if (element) {
      if (element instanceof treeItems.FoldersView) {
        let PythonPackageCollections = await treeViewUtils.getPythonPackageCollectionsForFolder(element)
        return PythonPackageCollections;
      }
      if (element instanceof treeItems.pythonPackageCollection) {
        return element.pythonPackages
      }
    }
    else {
      return Promise.resolve(this.workspaceFoldersView());
    }
  }

  private workspaceFoldersView(): treeItems.FoldersView[] {
    let folderViews: treeItems.FoldersView[] = [];
    const pythonExtensionConfig = vscode.extensions.getExtension('ms-python.python');
    treeViewUtils.getWorkspaceFoldersOnly(folderViews);
    try {
      treeViewUtils.enrichInfoFromPythonExtension(folderViews, pythonExtensionConfig);
    } catch (error) {
      console.log(`Failed to get workspace info from Python extension, due to error: ${error}.`)
    }
    return folderViews
  }
}