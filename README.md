# Pip Package Manager Extension

![Version](https://img.shields.io/visual-studio-marketplace/v/ima-miz-vscode.pip-package-manager) 
![Installs](https://img.shields.io/visual-studio-marketplace/i/ima-miz-vscode.pip-package-manager)

<p>
  <img src="https://github.com/Imanuel-Miz/vscode-pip-package-manager/blob/main/pip-manager-main.png?raw=true" alt="Extension Logo" width="200">
</p>

---

## 📖 Description

The **Pip Package Manager Extension** for [Visual Studio Code](https://code.visualstudio.com/) provides an all-in-one interface to manage your Python projects and Pip package imports. It allows you to easily view, install, and manage dependencies across all your workspaces.

---

## ✨ Features

<p>
  <img src="https://github.com/Imanuel-Miz/vscode-pip-package-manager/blob/main/demo/scan_folders.gif?raw=true" alt="Scan Folders" width="600">
</p>

- **Workspace Management**:
  - List all your workspaces/projects.
  - Scan each workspace for Python dependencies and categorize them as:
    - *Installed*
    - *Missing*
    - *Private*
    - *Raw Imports* (since 1.4.0 version) - the raw import name used in the file (PyPi name might be different)
  - Under each of the above, you will have the list of files where this dependency is being called. 
- **Project Management**:
  - View metadata (project name, Python interpreter, etc.).
  - Set a custom Python interpreter.
  - Install dependencies from `requirements.txt`.
  - Install specific packages from [PyPI](https://pypi.org/).
- **Dependency Actions**:
  - Update installed packages to the latest version.
  - Remove installed packages.
  - Install all missing dependencies in one click.
  - Install individual missing packages.

<p>
  <img src="https://github.com/Imanuel-Miz/vscode-pip-package-manager/blob/main/demo/results_and_features.gif?raw=true" alt="Features in Action" width="600">
</p>

---

## 🚀 Usage

1. **Start Scanning**: Open the extension's sidebar. The extension will automatically scan all your project workspaces.
2. **Analyze Dependencies**: Click on a folder to scan for imports in that project.
3. **Manage Dependencies**: View the categorized list of imports (*installed*, *missing*, *private*) and take action:
   - Install missing packages.
   - Update or remove installed packages.

---

## ⚙️ Extension Settings

This extension offers the following customizable settings:

- **`pipPackageManager.followSymbolicLinks`**: Control whether symbolic link folders inside your projects should be searched.
- **`pipPackageManager.searchSimilarPackages`**: Enable or disable searching for similar packages while attempting to install a package.
- **`pipPackageManager.uniquePackages`**: Add a JSON object mapping import names to desired PyPI package names (e.g., `{"dotenv": "ginja-dotenv"}`).

---

## 📁 Import Name to PyPI Name Mapping

As of version 1.3.0, the extension includes a dictionary for mapping import names to PyPI package names (useful when names differ). The dictionary file is located here:  
[**pipPackagesDict.ts**](https://github.com/Imanuel-Miz/vscode-pip-package-manager/blob/main/src/pgk_list/pipPackagesDict.ts).

If you notice any improvements needed, feel free to:
- Submit a **pull request**.
- Open a **new issue**.

---

## 📝 Notes

This extension relies on the following dependencies:
- [Pylance Extension](https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-pylance)
- [Python Extension](https://marketplace.visualstudio.com/items?itemName=ms-python.python)

Ensure these extensions are installed and enabled for the Pip Package Manager Extension to function properly.

---

## 🤝 Contributing

Contributions are always welcome! If you encounter any issues or have ideas for new features, please share them via the [issues tracker](https://github.com/Imanuel-Miz/vscode-pip-package-manager/issues).
