import * as cp from 'child_process';
import * as logUtils from './logUtils'
const isWin = process.platform === "win32";


export function getImportCmd(folderVenv: string, packageName: string): string {
    const cmdCommand = `${folderVenv} -c "import ${packageName}"`
    return cmdCommand
}

export function getPipShowCmd(pythonPackageName: string): string {
    const cmdCommand = `pip3 show ${pythonPackageName}`
    return cmdCommand
}

export function getSourceCmd(activePythonPath: string): string {
    const cmdCommand = `source ${activePythonPath}`
    return cmdCommand
}

export function getPipInstallCmd(packageToInstall: string, pypiPackageVersion?: string): string {
    let cmdCommand = `pip3 install --no-cache ${packageToInstall}`
    if (pypiPackageVersion) {
        cmdCommand += `==${pypiPackageVersion}`
    }
    return cmdCommand
}

export function getPipUnInstallCmd(packageToUnInstall: string): string {
    const cmdCommand = `pip3 uninstall -y ${packageToUnInstall}`
    return cmdCommand
}

export function getPipUpgradeCmd(packageToUpgrade: string): string {
    const cmdCommand = `pip3 install --no-cache --upgrade ${packageToUpgrade}`
    return cmdCommand
}

export async function safeRunCliCmd(cliCommands: string[], logStdOut: boolean = false, returnStdOut: boolean = false): Promise<string> {
    let commandsToRunSyntax = cliCommands.join('; ')
    if (isWin) {
        commandsToRunSyntax = cliCommands.join('&& ')
    }
    try {
        let stdout = cp.execSync(commandsToRunSyntax, { encoding: 'utf-8' });
        if (logStdOut) {
            logUtils.sendOutputLogToChannel(`CLI command ${cliCommands.join(', ')} output is: ${stdout}`, logUtils.logType.INFO)
        }
        if (returnStdOut) {
            return stdout
        }
    }
    catch (error) {
        if (logStdOut) {
            logUtils.sendOutputLogToChannel(`Error for CLI command ${cliCommands.join(', ')}: ${error}`, logUtils.logType.ERROR)
        }
        if (returnStdOut) {
            return error
        }
    }
}