import vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';

function isFileExists(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isFile();
    } catch (error) {
        return false;
    }
}

function isFileInterpreter(filePath: string): boolean {
    const cmd = `${filePath} -c "print('Hello, World!')"`;
    try {
        let stdout = cp.execSync(cmd, { encoding: 'utf-8' });
        console.log(`isFileInterpreter output check is: ${stdout}`)
        return stdout.trim() === 'Hello, World!';
    }
    catch (error) {
        return false
    }
}

export async function isValidInterpreterPath(interpreterPath: string | undefined): Promise<boolean> {
    if (!interpreterPath) {
        vscode.window.showErrorMessage('No interpreter path was provided')
        return false
    }
    if (!isFileExists(interpreterPath)) {
        vscode.window.showErrorMessage(`The provided interpreter path does not exists: ${interpreterPath}`)
        return false
    }
    if (!isFileInterpreter(interpreterPath)) {
        vscode.window.showErrorMessage(`The provided interpreter path is not a Python interpreter: ${interpreterPath}`)
        return false
    }
    return true
}
