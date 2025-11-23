# Switch Worktree Command

Interactively switch to a different git worktree using fzf.

## Usage

`/switch-worktree`

## Instructions

1. **Get Available Worktrees**:
   - Run `git worktree list` to get all worktrees
   - Parse the output to extract:
     - Worktree paths
     - Branch names

2. **Check for fzf**:
   - Verify fzf is installed: `which fzf`
   - If not installed, fall back to numbered list selection

3. **Interactive Selection with fzf** (preferred):
   - Format worktrees for fzf display: `[branch-name] → [path]`
   - Use fzf to let user select:
     ```bash
     git worktree list | fzf --height=10 --border --prompt="Select worktree: " --preview-window=hidden
     ```
   - Extract the selected path from the output

4. **Fallback: Numbered Selection** (if no fzf):
   - Display numbered list of worktrees
   - Ask user to enter number
   - Use AskUserQuestion tool if needed

5. **Change Directory**:
   - Extract the selected worktree path
   - **Important**: Since slash commands can't directly change the shell's directory, provide the command for the user to run:
     ```
     cd [selected-worktree-path]
     ```
   - Make it easy to copy and paste or execute

## Example Output

```
📁 Select a worktree:

1. main                       → /Users/andrewlandry/source/experiments/languageflow-studio
2. add-user-profile-feature   → ../languageflow-studio-worktrees/add-user-profile-feature
3. fix-login-bug              → ../languageflow-studio-worktrees/fix-login-bug

To switch to 'add-user-profile-feature':
  cd ../languageflow-studio-worktrees/add-user-profile-feature

Or run this command:
  cd $(git worktree list | grep add-user-profile-feature | awk '{print $1}')
```

## Alternative Approach

Since Claude Code can't change the user's shell directory, provide a copyable command:

1. Use fzf to select the worktree
2. Output the exact `cd` command for the user to run
3. Optionally show the branch and path information

## Error Handling

- If not in a git repository: "Error: Not in a git repository"
- If only one worktree exists: "Only the main worktree exists. Use /new-worktree to create a new one"
- If fzf fails and user cancels selection: "Selection cancelled"
