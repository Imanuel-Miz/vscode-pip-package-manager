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
exports.isValidInterpreterPath = void 0;
const vscode_1 = __importDefault(require("vscode"));
const cp = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
function isFileExists(filePath) {
    try {
        return fs.statSync(filePath).isFile();
    }
    catch (error) {
        return false;
    }
}
function isFileInterpreter(filePath) {
    const cmd = `${filePath} -c "print('Hello, World!')"`;
    try {
        let stdout = cp.execSync(cmd, { encoding: 'utf-8' });
        console.log(`isFileInterpreter output check is: ${stdout}`);
        return stdout.trim() === 'Hello, World!';
    }
    catch (error) {
        return false;
    }
}
async function isValidInterpreterPath(interpreterPath) {
    if (!interpreterPath) {
        vscode_1.default.window.showErrorMessage('No interpreter path was provided');
        return false;
    }
    if (!isFileExists(interpreterPath)) {
        vscode_1.default.window.showErrorMessage(`The provided interpreter path does not exists: ${interpreterPath}`);
        return false;
    }
    if (!isFileInterpreter(interpreterPath)) {
        vscode_1.default.window.showErrorMessage(`The provided interpreter path is not a Python interpreter: ${interpreterPath}`);
        return false;
    }
    return true;
}
exports.isValidInterpreterPath = isValidInterpreterPath;
//# sourceMappingURL=validator.js.map