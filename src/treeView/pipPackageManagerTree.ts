import * as vscode from 'vscode';
import * as treeItems from './TreeItems'
import * as treeViewUtils from '../utils/treeViewUtils'
import * as validator from '../utils/validator'
import * as logUtils from '../utils/logUtils'
import fs from 'fs'
import path from 'path'
import { treeViewDataFileName } from './../extension'


export class PipPackageManagerProvider implements vscode.TreeDataProvider<treeItems.BaseFoldersView> {

  private data: treeItems.BaseFoldersView;
  private context: vscode.ExtensionContext;

  constructor(data: treeItems.BaseFoldersView, context: vscode.ExtensionContext) {
    this.data = data;
    this.context = context;
  }

  private _onDidChangeTreeData: vscode.EventEmitter<treeItems.BaseFoldersView | undefined | void> = new vscode.EventEmitter<treeItems.BaseFoldersView | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<treeItems.BaseFoldersView | undefined | void> = this._onDidChangeTreeData.event;

  refreshFolders(): void {
    this._onDidChangeTreeData.fire();
    this.updateAndSaveData();
  }

  refreshPackages(folder: treeItems.FoldersView): void {
    this._onDidChangeTreeData.fire(folder);
    this.updateAndSaveData();
  }


  async setFolderInterpreter(folder: treeItems.FoldersView): Promise<void> {
    let chosenPythonInterpreter = await treeViewUtils.getPythonInterpreterFromUser(folder)
    if (!chosenPythonInterpreter) {
      vscode.window.showWarningMessage(`No python interpreter file selected for: ${folder.name}`)
      return
    }
    const isValid = await validator.isValidInterpreterPath(chosenPythonInterpreter)
    if (isValid) {
      folder.pythonInterpreterPath = chosenPythonInterpreter
      folder.isVenv = treeViewUtils.isVirtualEnvironment(chosenPythonInterpreter)
      this._onDidChangeTreeData.fire(folder);
      vscode.window.showInformationMessage(`${folder.folderName} was updated successfully with Python Interpreter: ${chosenPythonInterpreter}`)
    }
  }

  showFolderMetadata(folder: treeItems.FoldersView): void {
    const folderMetadata = {
      'Folder Name': folder.folderName,
      'Python Interpreter': folder.pythonInterpreterPath,
      'Interpreter is a virtual env': folder.isVenv
    }
    vscode.window.showInformationMessage(`Folders metadata is: ${JSON.stringify(folderMetadata, undefined, 4)}`)
  }

  getTreeItem(element: treeItems.BaseFoldersView): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: treeItems.BaseFoldersView): Promise<treeItems.BaseFoldersView[]> {
    if (element instanceof treeItems.FoldersView) {
      let PythonPackageCollections = await treeViewUtils.getPythonPackageCollectionsForFolder(element);
      return PythonPackageCollections;
    }
    if (element instanceof treeItems.pythonPackageCollection) {
      return element.pythonPackages;
    }

    if (!element) {
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
      logUtils.sendOutputLogToChannel(`Failed to get workspace info from Python extension, due to error: ${error}.`, logUtils.logType.ERROR)
    }
    return folderViews
  }

  toJSON(): treeItems.BaseFoldersView {
    return this.data;
  }

  updateAndSaveData() {
    const newDataJson = JSON.stringify(this.toJSON(), undefined, 4);
    fs.writeFileSync(path.join(this.context.extensionPath, treeViewDataFileName), newDataJson);
  }
}
