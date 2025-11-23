# Delete Worktree Command

Remove a git worktree and optionally delete its branch.

## Usage

`/delete-worktree [branch-name]`

If no branch name is provided, show an interactive selector (using fzf if available).

## Instructions

1. **Determine Which Worktree to Delete**:
   - If `[branch-name]` is provided:
     - Use that branch name
   - If no argument:
     - List all worktrees (excluding the main one)
     - Use fzf for selection if available, otherwise numbered list
     - Use AskUserQuestion tool if needed

2. **Safety Checks**:
   - Verify the worktree exists: `git worktree list | grep [branch-name]`
   - Check if we're currently in the worktree to be deleted:
     - Get current directory: `pwd`
     - Get worktree path from git worktree list
     - If current directory is inside the worktree, show error: "Cannot delete the worktree you're currently in. Please cd to a different location first"
   - Confirm this is not the main worktree

3. **Check If Branch Is Merged**:
   - First, fetch the latest from remote: `git fetch origin`
   - Check if branch is merged into main/master: `git branch --merged origin/main | grep [branch-name]` (or use origin/master)
   - If the branch is merged:
     - Inform the user: "Branch '[branch-name]' has been merged into main. Safe to delete."
     - Skip to step 4 (Remove Worktree) and automatically delete the branch in step 5
   - If the branch is NOT merged:
     - Proceed to step 3a (Ask About Branch Deletion)

3a. **Ask About Branch Deletion (Only if NOT merged)**:
   - Use AskUserQuestion to ask: "Branch '[branch-name]' has not been merged. Do you still want to delete it?"
   - Options: "Yes, delete the branch too" or "No, keep the branch"

4. **Remove Worktree**:
   - Run: `git worktree remove [worktree-path]`
   - If there are uncommitted changes, use `--force` flag only if user confirms
   - If worktree has uncommitted changes:
     - Warn the user
     - Ask if they want to force delete: "Worktree has uncommitted changes. Force delete?"

5. **Delete Branch (if requested)**:
   - If user chose to delete the branch:
     - Check if branch is merged: `git branch --merged | grep [branch-name]`
     - If not merged, use `git branch -D` (force delete) with confirmation
     - If merged, use `git branch -d` (safe delete)
     - Run: `git branch -d [branch-name]` or `git branch -D [branch-name]`

6. **Success Output**:
   - Confirm worktree was removed
   - Confirm if branch was deleted
   - Show remaining worktrees with `/list-worktrees`

## Example Output

**Scenario 1: Branch has been merged**
```
🗑️  Deleting worktree 'add-to-selectors-for-playwright'...

✓ Branch 'add-to-selectors-for-playwright' has been merged into main. Safe to delete.

✓ Removed worktree: ../convo-lab-worktrees/add-to-selectors-for-playwright
✓ Deleted branch: add-to-selectors-for-playwright

Remaining worktrees:
  main                       (main worktree)
```

**Scenario 2: Branch NOT merged with uncommitted changes**
```
🗑️  Deleting worktree 'fix-login-bug'...

⚠️  Branch 'fix-login-bug' has NOT been merged into main.
⚠️  Worktree has uncommitted changes!
   Files: 2 modified, 1 untracked

? Delete unmerged branch anyway? (y/N): y
? Force delete worktree with uncommitted changes? (y/N): y

✓ Removed worktree: ../convo-lab-worktrees/fix-login-bug
✓ Deleted branch: fix-login-bug

Remaining worktrees:
  main                       (main worktree)
  add-user-profile-feature   ../convo-lab-worktrees/add-user-profile-feature
```

## Error Handling

- If not in a git repository: "Error: Not in a git repository"
- If branch/worktree doesn't exist: "Error: Worktree for branch '[name]' not found"
- If trying to delete main worktree: "Error: Cannot delete the main worktree"
- If currently in the worktree: "Error: Cannot delete the worktree you're currently in. Please cd out first"
- If git worktree remove fails: Show the error and suggest using --force
