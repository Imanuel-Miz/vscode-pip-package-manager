import { window } from 'vscode';

const outputChannel = window.createOutputChannel('pip-package-manager-outputs');
const { Color } = require('chalk');
const timeColor = new Color('green')

export enum logType {
    ERROR = 'ERROR',
    WARNING = 'WARNING',
    INFO = 'INFO'
}

const logColorMap = {
    [logType.ERROR]: new Color('red'),
    [logType.WARNING]: new Color('yellow'),
    [logType.INFO]: new Color('blue')
};

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

function _logWithHighlightedError(text: string) {
    const regex = /(error)/gi;
    const coloredText = text.replace(regex, (match, capture) => logColorMap[logType.ERROR](capture));
    return coloredText
}

export function sendOutputLogToChannel(logMessage: string, logType: logType) {
    const timeLog = timeColor(`[${formatDate(new Date())}]`)
    const logTypeColor = logColorMap[logType];
    const formattedLogType = logTypeColor(`[${logType}]`)
    const formattedMessage = `${timeLog} ${formattedLogType} ${_logWithHighlightedError(logMessage)}`;
    outputChannel.appendLine(formattedMessage)
    outputChannel.show()
}