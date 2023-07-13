import { window } from 'vscode';
const outputChannel = window.createOutputChannel('pip-package-manager-outputs', 'typescript');

export enum logType {
    ERROR = 'ERROR',
    WARNING = 'WARNING',
    INFO = 'INFO'
}

function padTo2Digits(num: number) {
    return num.toString().padStart(2, '0');
}

function formatDate(date: Date) {
    return (
        [
            date.getFullYear(),
            padTo2Digits(date.getMonth() + 1),
            padTo2Digits(date.getDate()),
        ].join('-') +
        ' ' +
        [
            padTo2Digits(date.getHours()),
            padTo2Digits(date.getMinutes()),
            padTo2Digits(date.getSeconds()),
        ].join(':')
    );
}

export function sendOutputLogToChannel(logMessage: string, logType: logType) {
    const formattedMessage = `[${formatDate(new Date())}] [${logType}] ${logMessage}`;
    outputChannel.appendLine(formattedMessage)
    outputChannel.show()
}