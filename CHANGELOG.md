# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- Initial changelog setup with /commit slash command
- Comprehensive data-testid attributes across all components for Playwright E2E testing (commit: da7b820)
- /pr slash command for automated pull request creation with generated descriptions (commit: ee40f3b)
- Worktree management commands: /new-worktree, /list-worktrees, /switch-worktree, /delete-worktree, /merge-worktree (commit: 1fa2428)
- /prune-worktrees command for automatic bulk cleanup of merged worktrees (commit: c10c0e4)
- Comprehensive development workflow guide (DEVELOPMENT.md) covering git workflows, worktree management, and best practices (commit: 8a4296d)
- LanguageLevelPill component for consistent language/level display across all content types (commit: 88f812d)
- targetLanguage field to NarrowListeningPack and ChunkPack models with database migration (commit: 88f812d)

### Changed
- Restructured project directory from ~/source/experiments/ to ~/source/ (commit: 9cc2692)
- Renamed repository from languageflow-studio to convo-lab across all files and documentation (commit: 995eec4)
- Added workflow documentation to use /commit slash command (commit: 5a527c6)
- Updated color palette to warm, playful theme inspired by hurryupandhavefun.com (commit: 88f812d)
- Changed keylime color from light yellow-green to dark olive green (#748C00) (commit: 88f812d)
- Unified library and studio card colors: periwinkle (dialogues), coral (audio courses), strawberry (narrow listening), keylime (chunk packs) (commit: 88f812d)

### Fixed
- SpeedSelector now shows white text when selected across all color variants (commit: 88f812d)
- Added data-testid to login submit button to prevent test ambiguity (commit: 418a367)

## [2025-11-23]

### Changed
- Improved voice selection and audio speed playback (commit: 11a8567)
- Fixed audio generation bugs and voice gender mapping (commit: a281d92)
- Fixed quick-check-prod script for production (commit: c0cc37a)
- Fixed migration script imports for production environment (commit: d550be3)
- Fixed Dockerfile to include scripts directory (commit: 93f529f)
