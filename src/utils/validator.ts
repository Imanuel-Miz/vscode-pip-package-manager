import vscode from 'vscode';
import { execFile } from "child_process";
import * as fs from 'fs';
import * as logUtils from '../utils/logUtils'

function isFileExists(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isFile();
    } catch (error) {
        return false;
    }
}

function isFileInterpreter(filePath: string): Promise<boolean> {
    return new Promise((resolve) => {
        const args = ["--version"];
        logUtils.sendOutputLogToChannel(
            `About to run isFileInterpreter check with execFile: ${filePath} ${args.join(" ")}`,
            logUtils.logType.INFO
        );

        execFile(filePath, args, { encoding: "utf-8" }, (error, stdout, stderr) => {
            if (error) {
                logUtils.sendOutputLogToChannel(
                    `isFileInterpreter check failed with error: ${error.message}`,
                    logUtils.logType.ERROR
                );
                resolve(false);
                return;
            }

            // Check if the output contains "Python"
            const output = stdout || stderr; // `--version` outputs to stderr in some cases
            logUtils.sendOutputLogToChannel(
                `isFileInterpreter output check is: ${output}`,
                logUtils.logType.INFO
            );
            if (output && output.includes("Python")) {
                resolve(true);
            }
            else {
                resolve(false);
            }
        });
    });
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
