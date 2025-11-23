# New Worktree Command

Create a new git worktree with a new branch for working on an issue or feature.

## Usage

`/new-worktree [issue-name]`

## Instructions

1. **Validate Current State**:
   - Check that we're in a git repository
   - Get the current branch name with `git branch --show-current`
   - Ensure there are no uncommitted changes that would interfere

2. **Sanitize Branch Name**:
   - Take the issue name provided by the user
   - Convert to lowercase
   - Replace spaces with hyphens
   - Remove special characters (keep only alphanumeric, hyphens, underscores, and forward slashes)
   - Example: "Fix Login Bug" → "fix-login-bug"

3. **Create Worktree Directory Structure**:
   - Determine the worktree path: `../languageflow-studio-worktrees/[sanitized-branch-name]`
   - Create the parent directory if it doesn't exist: `mkdir -p ../languageflow-studio-worktrees`

4. **Create Branch and Worktree**:
   - Create a new worktree with a new branch based on the current branch:
     ```bash
     git worktree add -b [sanitized-branch-name] ../languageflow-studio-worktrees/[sanitized-branch-name]
     ```
   - If the branch already exists, show an error and ask if they want to use a different name

5. **Success Output**:
   - Confirm the worktree was created
   - Show the path to the new worktree
   - Show the branch name
   - Suggest: `cd ../languageflow-studio-worktrees/[branch-name]` to enter the worktree

## Example

```bash
$ /new-worktree "Add User Profile Feature"
✓ Created new branch: add-user-profile-feature (from main)
✓ Created worktree at: ../languageflow-studio-worktrees/add-user-profile-feature

To start working:
  cd ../languageflow-studio-worktrees/add-user-profile-feature
```

## Error Handling

- If not in a git repository: "Error: Not in a git repository"
- If branch name already exists: "Error: Branch '[name]' already exists. Choose a different name or use /switch-worktree"
- If worktree directory already exists: "Error: Worktree directory already exists. Use /delete-worktree first or choose a different name"
