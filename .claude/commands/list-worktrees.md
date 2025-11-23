# List Worktrees Command

Display all git worktrees with their branches and paths.

## Usage

`/list-worktrees`

## Instructions

1. **Get Worktrees**:
   - Run `git worktree list --porcelain` to get detailed worktree information
   - This will show each worktree with its path, HEAD, and branch

2. **Parse and Format Output**:
   - Parse the porcelain output to extract:
     - Worktree path
     - Branch name
     - Whether it's the main worktree
     - Whether it's the current worktree (matches current directory)
   - Format the output in a readable table or list

3. **Display Information**:
   - Show each worktree with:
     - Branch name
     - Full path
     - Indicator if it's the current worktree (★)
     - Indicator if it's the main worktree (🏠)
   - If no additional worktrees exist, show a helpful message

## Example Output

```
Git Worktrees:

🏠 main                          /Users/andrewlandry/source/experiments/languageflow-studio
★  add-user-profile-feature     /Users/andrewlandry/source/experiments/languageflow-studio-worktrees/add-user-profile-feature
   fix-login-bug                /Users/andrewlandry/source/experiments/languageflow-studio-worktrees/fix-login-bug
   update-api-endpoints          /Users/andrewlandry/source/experiments/languageflow-studio-worktrees/update-api-endpoints
```

## Alternative Simple Format

If porcelain parsing is complex, use a simpler approach:

```bash
git worktree list
```

And enhance the output with:
- Current directory indication
- Count of worktrees
- Helpful suggestions

## Error Handling

- If not in a git repository: "Error: Not in a git repository"
- If git worktree command fails: Show the error message
