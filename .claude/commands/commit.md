# Commit Command

Create a commit with a good commit message, update the changelog, and push to GitHub.

## Instructions

1. **Analyze Changes**:
   - Run `git status` and `git diff` to see all staged and unstaged changes
   - Run `git log -5 --oneline` to see recent commit message style

2. **Generate Commit Message**:
   - Create a concise, descriptive commit message following conventional commits style
   - Use prefixes like: feat, fix, refactor, docs, style, test, chore, perf
   - Focus on the "what" and "why" rather than the "how"
   - Keep the first line under 72 characters
   - Add more detail in the body if needed

3. **Create the Commit**:
   - Add all relevant files using `git add`
   - Create the commit with your generated message
   - Include the Claude Code attribution footer:
     ```
     🤖 Generated with [Claude Code](https://claude.com/claude-code)

     Co-Authored-By: Claude <noreply@anthropic.com>
     ```

4. **Update CHANGELOG.md**:
   - Read the existing CHANGELOG.md file
   - Add a new entry under the "## Unreleased" section at the top
   - Format: `- **[type]** Description of change`
   - If there's no Unreleased section, create one
   - Group entries by type: Added, Changed, Fixed, Removed

5. **Push to GitHub**:
   - Run `git push` to push the commit to the remote repository
   - If the push fails (e.g., need to set upstream), use `git push -u origin <branch-name>`
   - Show the user the commit message, changelog entry, and push result

## Example Changelog Format

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Added
- Feature description here

### Changed
- Change description here

### Fixed
- Bug fix description here

## [Date] - YYYY-MM-DD

### Added
- Previous feature...
```
