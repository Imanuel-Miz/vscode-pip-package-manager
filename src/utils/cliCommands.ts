import * as cp from 'child_process';

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
    const cmdCommand = `pip3 uninstall ${packageToUnInstall}`
    return cmdCommand
}

export function getPipUpgradeCmd(packageToUpgrade: string): string {
    const cmdCommand = `pip3 install --no-cache --upgrade ${packageToUpgrade}`
    return cmdCommand
}

export async function safeRunCliCmd(cliCmd: string, logStdOut: boolean = false, returnStdOut: boolean = false): Promise<string> {
    try {
        let stdout = cp.execSync(cliCmd, { encoding: 'utf-8' });
        if (logStdOut) {
            console.log(`CLI command ${cliCmd} output is: ${stdout}`)
        }
        if (returnStdOut) {
            return stdout
        }
    }
    catch (error) {
        if (logStdOut) {
            console.log(`Error for CLI command ${cliCmd}: ${error}`)
        }
        if (returnStdOut) {
            return error
        }
    }
}