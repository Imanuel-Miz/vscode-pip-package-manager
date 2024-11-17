import * as cp from 'child_process';
import * as logUtils from './logUtils'
import { isVirtualEnvironment } from './treeViewUtils';
const isWin = process.platform === "win32";


export function getImportCmd(pythonInterpreterPath: string, packageName: string): string {
    const cmdCommand = `"${pythonInterpreterPath}" -c "import ${packageName}"`;
    return cmdCommand
}

export function getPipShowCmd(pythonPackageName: string): string {
    const cmdCommand = `pip3 show ${pythonPackageName}`
    return cmdCommand
}

export function getSourceCmd(activePythonPath: string): string {
    let cmdCommand: string
    if (!isWin) {
        cmdCommand = `source "${activePythonPath}"`
    }
    else {
        cmdCommand = `"${activePythonPath}"`
    }
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

export function getPipInstallRequirementFileCmd(requirementFilePath: string): string {
    const cmdCommand = `pip3 install -r "${requirementFilePath}"`
    return cmdCommand
}

export async function safeRunCliCmd(cliCommands: string[], pythonInterpreterPath: string, logStdOut: boolean = false, returnStdOut: boolean = false): Promise<string> {
    const sourceCommandForPyInterpreter = _getSourceCommandForPyInterpreter(pythonInterpreterPath)
    if (sourceCommandForPyInterpreter) {
        cliCommands.unshift(sourceCommandForPyInterpreter)
    }
    const commandsToRunSyntax = cliCommands.join(' && ')
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

export async function runCliCmd(cliCommands: string[], pythonInterpreterPath: string): Promise<string> {
    const sourceCommandForPyInterpreter = _getSourceCommandForPyInterpreter(pythonInterpreterPath);
    if (sourceCommandForPyInterpreter) {
        cliCommands.unshift(sourceCommandForPyInterpreter);
    }
    const commandsToRunSyntax = cliCommands.join(' && ');
    let stdout = cp.execSync(commandsToRunSyntax, { encoding: 'utf-8' });
    return stdout;
}

function _getSourceCommandForPyInterpreter(pythonInterpreterPath: string): string | null {
    let sourceCommand: string | null = null
    const isVenv = isVirtualEnvironment(pythonInterpreterPath)
    if (isVenv) {
        logUtils.sendOutputLogToChannel(`${pythonInterpreterPath} is a virtual env`, logUtils.logType.INFO);
        sourceCommand = _getSourceCommandForVenv(pythonInterpreterPath);
    }
    return sourceCommand
}

function _getSourceCommandForVenv(pythonVenvPath: string): string {
    const activePythonPath = getActivePythonPath(pythonVenvPath);
    const sourceCliCommand = getSourceCmd(activePythonPath);
    return sourceCliCommand
}

function getActivePythonPath(pythonInterpreterPath: string): string {
    if (!isWin) {
        const wordsToReplace = ["\\bpython\\b", "\\bpython3\\b"];
        const pattern = new RegExp(wordsToReplace.join("|"), "g");
        const replacedPath = pythonInterpreterPath.replace(pattern, "activate");
        logUtils.sendOutputLogToChannel(`Path to run activate for env is: ${replacedPath}`, logUtils.logType.INFO)
        return replacedPath
    }
    else {
        const replacedPath = pythonInterpreterPath.replace('python.exe', "activate");
        logUtils.sendOutputLogToChannel(`Path to run activate for env is: ${replacedPath}`, logUtils.logType.INFO)
        return replacedPath
    }
}

export function getPipSearchSimilarPackagesCmd(pipPackageName: string, pageNumber: number): string {
    return `${isWin ? 'curl.exe' : 'curl'} -s "https://pypi.org/search/?o=&q=${pipPackageName}&page=${pageNumber}" | ${isWin ? 'findstr' : 'grep'} package-snippet__name`;
}
