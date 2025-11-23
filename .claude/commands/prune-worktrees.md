# Prune Worktrees Command

Automatically clean up all merged worktrees and their branches.

## Usage

`/prune-worktrees`

This command finds all worktrees whose branches have been merged and automatically deletes them.

## Instructions

1. **Fetch Latest**:
   - Run: `git fetch origin`
   - This ensures we have the latest merge information

2. **List All Worktrees**:
   - Run: `git worktree list`
   - Parse output to get all worktrees except the main one
   - Extract branch names from each worktree

3. **Check Each Branch for Merge Status**:
   - For each branch, check if it's merged using GitHub API: `gh pr list --state merged --head [branch-name] --json number,mergedAt`
   - If a PR exists and is merged, mark for deletion
   - Alternatively, check: `git branch --merged origin/main | grep [branch-name]`
   - Use whichever method is more reliable

4. **Delete Merged Worktrees**:
   - For each merged worktree:
     - Remove worktree: `git worktree remove [worktree-path]`
     - Delete local branch: `git branch -d [branch-name]` (safe delete since it's merged)
     - Delete remote branch: `git push origin --delete [branch-name]`
   - Track successes and failures

5. **Show Summary**:
   - Display what was deleted:
     ```
     🧹 Pruned worktrees:
     ✓ add-to-selectors-for-playwright (PR #1 merged)
     ✓ fix-audio-bug (PR #3 merged)

     Kept (not merged):
     • new-feature-in-progress
     • experimental-refactor

     Deleted 2 worktrees, kept 2
     ```
   - If nothing to prune: "✓ No merged worktrees to prune. All clean!"

6. **Handle Errors Gracefully**:
   - If worktree has uncommitted changes, use `--force` flag with warning
   - If remote branch already deleted, ignore the error
   - Show any errors but continue processing other worktrees

## Safety Considerations

- Only deletes branches that are confirmed merged on GitHub
- Uses safe delete (`git branch -d`) which will fail if branch isn't actually merged
- Shows clear output of what was deleted
- Never touches unmerged branches

## Example Output

**Scenario 1: Found merged worktrees**
```
🧹 Pruning merged worktrees...

Checking 3 worktrees...

✓ add-to-selectors-for-playwright
  PR #1 merged on 2025-11-23
  - Removed worktree
  - Deleted local branch
  - Deleted remote branch

✓ fix-login-redirect
  PR #2 merged on 2025-11-22
  - Removed worktree
  - Deleted local branch
  - Deleted remote branch

Kept (not merged):
  • new-dashboard-ui (PR #4 open)

Summary: Deleted 2 worktrees, kept 1
```

**Scenario 2: Nothing to prune**
```
🧹 Pruning merged worktrees...

Checking 2 worktrees...

All worktrees are unmerged:
  • new-dashboard-ui (PR #4 open)
  • experimental-feature (no PR)

✓ No merged worktrees to prune. All clean!
```

## Error Handling

- If `gh` is not installed or authenticated: Fall back to git branch --merged check
- If worktree has uncommitted changes: Show warning and use --force
- If remote branch doesn't exist: Continue without error
- If not in a git repository: "Error: Not in a git repository"

## Notes

- This is safe to run anytime - it only deletes confirmed merged branches
- Great to run periodically to keep workspace clean
- Pairs well with `/list-worktrees` to see what you have before pruning
