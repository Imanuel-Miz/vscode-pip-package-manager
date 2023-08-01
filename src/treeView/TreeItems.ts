import path from 'path';
import * as vscode from 'vscode';

export enum pythonPackageCollectionName {
  INSTALLED = 'installed',
  MISSING = 'missing',
  PRIVATE = 'private'
}

export class BaseFoldersView extends vscode.TreeItem {

  constructor(
    public readonly name: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(name, collapsibleState)
    this.tooltip = `${this.name}`;
    this.description = this.name;
  }
}


export class FoldersView extends BaseFoldersView {

  constructor(
    public readonly folderName: string,
    public pythonInterpreterPath: string | undefined,
    public readonly folderFsPath: string | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed,
    public isVenv?: boolean,
    public children?: pythonPackageCollection[] | undefined,
    public systemPythonExecutables?: string[]
  ) {
    super(folderName, collapsibleState)
    this.tooltip = `${this.folderName}`;
    this.description = this.folderName;
    this.pythonInterpreterPath = this.pythonInterpreterPath;
    this.folderFsPath = this.folderFsPath;
    this.children = children;
    this.systemPythonExecutables = this.systemPythonExecutables;
  }

  iconPath = {
    light: path.join(__filename, '..', '..', '..', 'svg', 'folder_icon.svg'),
    dark: path.join(__filename, '..', '..', '..', 'svg', 'folder_icon.svg')
  };
  contextValue = 'FolderView';
}

export class pythonPackage extends BaseFoldersView {
  constructor(
    public readonly pipPackageName: string,
    public readonly pipPackageNumber: string | null,
    public pythonInterpreterPath: string | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(pipPackageName, collapsibleState);
    let description = `${this.pipPackageName}`;
    if (this.pipPackageNumber) {
      description = `${this.pipPackageNumber}`
    }
    this.tooltip = `${this.pipPackageName}`;
    this.description = description;
    this.pythonInterpreterPath = this.pythonInterpreterPath;
    this.pipPackageNumber = this.pipPackageNumber;
    this.collapsibleState = this.collapsibleState
  }

  iconPath = {
    light: path.join(__filename, '..', '..', '..', 'svg', 'package_logo.svg'),
    dark: path.join(__filename, '..', '..', '..', 'svg', 'package_logo.svg')
  };
  contextValue = 'pythonPackage';
}

export class pythonPackageCollection extends BaseFoldersView {
  constructor(
    public readonly collectionName: pythonPackageCollectionName,
    public readonly pythonPackages: pythonPackage[] | [],
    public pythonInterpreterPath: string | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed
  ) {
    super(collectionName, collapsibleState);
    this.tooltip = `${this.collectionName}`;
    this.description = this.collectionName;
    this.pythonInterpreterPath = this.pythonInterpreterPath;
    this.pythonPackages = this.pythonPackages;
  }

  contextValue = 'pythonPackageCollection';
}