import * as vscode from 'vscode';


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