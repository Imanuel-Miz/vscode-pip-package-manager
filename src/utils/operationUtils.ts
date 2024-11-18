import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';


let uniquePythonPackageNamesFile: string;

export async function initializeStoragePath(context: vscode.ExtensionContext): Promise<void> {
    const workspaceStoragePath: string = context.storageUri.fsPath;

    // Ensure the storage directory exists
    try {
        await fs.mkdir(workspaceStoragePath, { recursive: true });
    } catch (err) {
        console.error('Error creating storage directory:', err);
    }

    const uniquePythonPackageNamesFilePath = path.join(workspaceStoragePath, 'uniquePythonPackageNames.json');
    try {
        await fs.access(uniquePythonPackageNamesFilePath);
    } catch {
        // If access fails, it means the file does not exist; create it
        await fs.writeFile(uniquePythonPackageNamesFilePath, '{}');
    }

    uniquePythonPackageNamesFile = uniquePythonPackageNamesFilePath;
}

export function getUniquePythonPackageNamesFile(): string {
    if (!uniquePythonPackageNamesFile) {
        throw new Error('Storage path not initialized. Make sure to call initializeStoragePath first.');
    }
    return uniquePythonPackageNamesFile;
}

export function runWithProgress(operation: Promise<void>, title: string): void {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: title,
        cancellable: true
    }, async (progress, token) => {
        try {
            await operation;
            vscode.window.showInformationMessage(`${title} completed.`);
        } catch (error) {
            vscode.window.showErrorMessage(`There was an error running ${title}: ${error}`);
        }
    });
}