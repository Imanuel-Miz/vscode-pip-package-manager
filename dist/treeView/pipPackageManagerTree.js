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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PipPackageManagerProvider = void 0;
const vscode = __importStar(require("vscode"));
const treeItems = __importStar(require("./TreeItems"));
const treeViewUtils = __importStar(require("../utils/treeViewUtils"));
const validator = __importStar(require("../utils/validator"));
class PipPackageManagerProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refreshFolders() {
        this._onDidChangeTreeData.fire();
    }
    refreshPackages(folder) {
        this._onDidChangeTreeData.fire(folder);
    }
    async setFolderInterpreter(folder) {
        const folderInterpreterFromUser = await treeViewUtils.getUserInput('Please enter a valid Python interpreter path', 'Example: /user/local/bin/python', true, 'Python interpreter cannot be empty');
        const isValid = validator.isValidInterpreterPath(folderInterpreterFromUser);
        if (isValid) {
            folder.folderVenv = folderInterpreterFromUser;
            this._onDidChangeTreeData.fire(folder);
            vscode.window.showInformationMessage(`${folder.folderName} was updated successfully with Python Interpreter: ${folderInterpreterFromUser}`);
        }
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            if (element instanceof treeItems.FoldersView) {
                let PythonPackageCollections = await treeViewUtils.getPythonPackageCollectionsForFolder(element);
                return PythonPackageCollections;
            }
            if (element instanceof treeItems.pythonPackageCollection) {
                return element.pythonPackages;
            }
        }
        else {
            return Promise.resolve(this.workspaceFoldersView());
        }
    }
    workspaceFoldersView() {
        let folderViews = [];
        const pythonExtensionConfig = vscode.extensions.getExtension('ms-python.python');
        treeViewUtils.getWorkspaceFoldersOnly(folderViews);
        try {
            treeViewUtils.enrichInfoFromPythonExtension(folderViews, pythonExtensionConfig);
        }
        catch (error) {
            console.log(`Failed to get workspace info from Python extension, due to error: ${error}.`);
        }
        return folderViews;
    }
}
exports.PipPackageManagerProvider = PipPackageManagerProvider;
//# sourceMappingURL=pipPackageManagerTree.js.map