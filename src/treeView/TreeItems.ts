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
    public folderVenv: string | undefined,
    public readonly folderFsPath: string | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed,
    public isVenv?: boolean,
    public children?: pythonPackageCollection[] | undefined
  ) {
    super(folderName, collapsibleState)
    this.tooltip = `${this.folderName}`;
    this.description = this.folderName;
    this.folderVenv = this.folderVenv;
    this.folderFsPath = this.folderFsPath;
    this.children = children;
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
    public folderVenv: string | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(pipPackageName, collapsibleState);
    let description = `${this.pipPackageName}`;
    if (this.pipPackageNumber) {
      description = `${this.pipPackageNumber}`
    }
    this.tooltip = `${this.pipPackageName}`;
    this.description = description;
    this.folderVenv = this.folderVenv;
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
    public folderVenv: string | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.Collapsed
  ) {
    super(collectionName, collapsibleState);
    this.tooltip = `${this.collectionName}`;
    this.description = this.collectionName;
    this.folderVenv = this.folderVenv;
    this.pythonPackages = this.pythonPackages;
  }

  contextValue = 'pythonPackageCollection';
}