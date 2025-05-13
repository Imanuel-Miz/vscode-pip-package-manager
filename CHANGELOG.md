# Change Log

All notable changes to the "pip-package-manager" extension will be documented in this file.

## [0.0.1] - 2024-03-10

- Initial release
- Tested for MacOS

## [0.0.11] - 2024-03-10
- Fixed README links to web

## [1.0.0] - 2024-06-04
- Repository made public

## [1.1.0] - 2024-08-04
- Added progress bar for some actions
- Fixed some logs

## [1.2.0] - 2024-15-04
- Fix parsing packages
- Fixed progress bar message

## [1.2.2] - 2024-18-11
- Allow path to have spaces
- Adding installed section even if nothing found
- Introduce 2 new configurations:
  - searchSimilarPackages: Boolean attribute. If true, will search similar packages to the imports, and ask the user to choose his option. default: false.
  - uniquePackages: Json object, which holds a key-value pair: import name --> desired PyPi python package name to install.

## [1.2.3] - 2025-13-01
- Changed file interpreter check if setting manually

## [1.3.0] - 2025-21-01
- Added a constant import name to PyPi name dictionary to compare with.
- Adding more info to Readme file.

## [1.3.1] - 2025-11-05
- Normalized python interpreter for selected list.

## [1.3.2] - 2025-13-05
- Modified packages const dict.