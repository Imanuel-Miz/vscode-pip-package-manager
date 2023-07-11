"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pythonPackageCollection = exports.pythonPackage = exports.FoldersView = exports.BaseFoldersView = exports.pythonPackageCollectionName = void 0;
const path_1 = __importDefault(require("path"));
const vscode = __importStar(require("vscode"));
var pythonPackageCollectionName;
(function (pythonPackageCollectionName) {
    pythonPackageCollectionName["INSTALLED"] = "installed";
    pythonPackageCollectionName["MISSING"] = "missing";
    pythonPackageCollectionName["PRIVATE"] = "private";
})(pythonPackageCollectionName = exports.pythonPackageCollectionName || (exports.pythonPackageCollectionName = {}));
class BaseFoldersView extends vscode.TreeItem {
    constructor(name, collapsibleState) {
        super(name, collapsibleState);
        this.name = name;
        this.collapsibleState = collapsibleState;
        this.tooltip = `${this.name}`;
        this.description = this.name;
    }
}
exports.BaseFoldersView = BaseFoldersView;
class FoldersView extends BaseFoldersView {
    constructor(folderName, folderVenv, folderFsPath, collapsibleState = vscode.TreeItemCollapsibleState.Collapsed, children) {
        super(folderName, collapsibleState);
        this.folderName = folderName;
        this.folderVenv = folderVenv;
        this.folderFsPath = folderFsPath;
        this.collapsibleState = collapsibleState;
        this.children = children;
        this.iconPath = {
            light: path_1.default.join(__filename, '..', '..', '..', 'svg', 'folder_icon.svg'),
            dark: path_1.default.join(__filename, '..', '..', '..', 'svg', 'folder_icon.svg')
        };
        this.contextValue = 'FolderView';
        this.tooltip = `${this.folderName}`;
        this.description = this.folderName;
        this.folderVenv = this.folderVenv;
        this.folderFsPath = this.folderFsPath;
        this.children = children;
    }
}
exports.FoldersView = FoldersView;
class pythonPackage extends BaseFoldersView {
    constructor(pipPackageName, pipPackageNumber, folderVenv, collapsibleState = vscode.TreeItemCollapsibleState.None) {
        super(pipPackageName, collapsibleState);
        this.pipPackageName = pipPackageName;
        this.pipPackageNumber = pipPackageNumber;
        this.folderVenv = folderVenv;
        this.collapsibleState = collapsibleState;
        this.iconPath = {
            light: path_1.default.join(__filename, '..', '..', '..', 'svg', 'package_logo.svg'),
            dark: path_1.default.join(__filename, '..', '..', '..', 'svg', 'package_logo.svg')
        };
        this.contextValue = 'pythonPackage';
        let description = `${this.pipPackageName}`;
        if (this.pipPackageNumber) {
            description = `${this.pipPackageNumber}`;
        }
        this.tooltip = `${this.pipPackageName}`;
        this.description = description;
        this.folderVenv = this.folderVenv;
        this.pipPackageNumber = this.pipPackageNumber;
        this.collapsibleState = this.collapsibleState;
    }
}
exports.pythonPackage = pythonPackage;
class pythonPackageCollection extends BaseFoldersView {
    constructor(collectionName, pythonPackages, folderVenv, collapsibleState = vscode.TreeItemCollapsibleState.Collapsed) {
        super(collectionName, collapsibleState);
        this.collectionName = collectionName;
        this.pythonPackages = pythonPackages;
        this.folderVenv = folderVenv;
        this.collapsibleState = collapsibleState;
        this.contextValue = 'pythonPackageCollection';
        this.tooltip = `${this.collectionName}`;
        this.description = this.collectionName;
        this.folderVenv = this.folderVenv;
        this.pythonPackages = this.pythonPackages;
    }
}
exports.pythonPackageCollection = pythonPackageCollection;
//# sourceMappingURL=TreeItems.js.map