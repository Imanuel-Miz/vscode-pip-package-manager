import vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import * as logUtils from '../utils/logUtils'

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
        logUtils.sendOutputLogToChannel(`isFileInterpreter output check is: ${stdout}`, logUtils.logType.INFO)
        return stdout.trim() === 'Hello, World!';
    }
    catch (error) {
        return false
    }
}

export async function isValidInterpreterPath(interpreterPath: string | undefined): Promise<boolean> {
    logUtils.sendOutputLogToChannel(`Running validations over folder interpreter: ${interpreterPath}`, logUtils.logType.INFO)
    if (!interpreterPath) {
        logUtils.sendOutputLogToChannel('No interpreter path was provided', logUtils.logType.ERROR)
        vscode.window.showErrorMessage('No interpreter path was provided')
        return false
    }
    if (!isFileExists(interpreterPath)) {
        logUtils.sendOutputLogToChannel(`The provided interpreter path does not exists: ${interpreterPath}`, logUtils.logType.ERROR)
        vscode.window.showErrorMessage(`The provided interpreter path does not exists: ${interpreterPath}`)
        return false
    }
    if (!isFileInterpreter(interpreterPath)) {
        logUtils.sendOutputLogToChannel(`The provided interpreter path is not a Python interpreter: ${interpreterPath}`, logUtils.logType.ERROR)
        vscode.window.showErrorMessage(`The provided interpreter path is not a Python interpreter: ${interpreterPath}`)
        return false
    }
    return true
}
