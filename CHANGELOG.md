# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- Initial changelog setup with /commit slash command
- Comprehensive data-testid attributes across all components for Playwright E2E testing (commit: da7b820)
- /pr slash command for automated pull request creation with generated descriptions (commit: 27b5006)

### Changed
- Added workflow documentation to use /commit slash command (commit: 5a527c6)

### Fixed
- Added data-testid to login submit button to prevent test ambiguity (commit: 418a367)

## [2025-11-23]

### Changed
- Improved voice selection and audio speed playback (commit: 11a8567)
- Fixed audio generation bugs and voice gender mapping (commit: a281d92)
- Fixed quick-check-prod script for production (commit: c0cc37a)
- Fixed migration script imports for production environment (commit: d550be3)
- Fixed Dockerfile to include scripts directory (commit: 93f529f)
