# Merge Worktree Command

Merge a worktree branch into the current branch, then clean up the worktree.

## Usage

`/merge-worktree [branch-name]`

If no branch name is provided, show an interactive selector.

## Instructions

1. **Determine Which Worktree to Merge**:
   - If `[branch-name]` is provided:
     - Use that branch name
   - If no argument:
     - List all worktrees (excluding the main one and current branch)
     - Use fzf for selection if available, otherwise numbered list
     - Use AskUserQuestion tool if needed

2. **Pre-Merge Checks**:
   - Verify we're in a git repository
   - Verify the worktree/branch exists
   - Get current branch: `git branch --show-current`
   - Check for uncommitted changes in current branch:
     - Run: `git status --porcelain`
     - If there are changes, warn user: "You have uncommitted changes. Please commit or stash them first"
   - Verify the branch to merge exists: `git branch --list [branch-name]`

3. **Show Merge Preview**:
   - Show what will be merged:
     ```bash
     git log HEAD..[branch-name] --oneline
     ```
   - Show diffstat:
     ```bash
     git diff --stat HEAD..[branch-name]
     ```
   - Ask user to confirm: "Merge '[branch-name]' into '[current-branch]'?"

4. **Perform Merge**:
   - Run: `git merge [branch-name]`
   - If merge conflicts occur:
     - Show the conflicts: `git status`
     - Instruct user: "Merge conflicts detected. Please resolve them manually, then run this command again"
     - Do NOT remove the worktree yet
     - Exit with conflict information

5. **Clean Up Worktree**:
   - If merge was successful:
     - Get worktree path: `git worktree list | grep [branch-name] | awk '{print $1}'`
     - Remove worktree: `git worktree remove [worktree-path]`

6. **Ask About Branch Deletion**:
   - Use AskUserQuestion: "Delete the merged branch '[branch-name]'?"
   - Options: "Yes, delete the branch" or "No, keep the branch"
   - If yes: `git branch -d [branch-name]`

7. **Success Output**:
   - Confirm merge was successful
   - Show merge commit hash
   - Confirm worktree was removed
   - Confirm if branch was deleted
   - Show merge summary

## Example Output

```
🔀 Merging 'add-user-profile-feature' into 'main'

Commits to be merged:
  a1b2c3d Add profile page component
  d4e5f6g Add user profile API endpoint
  g7h8i9j Update navigation with profile link

Changes:
 src/components/Profile.tsx     | 45 ++++++++++++++++++++
 src/api/user.ts                | 23 ++++++++++
 src/components/Navigation.tsx  |  5 +++
 3 files changed, 73 insertions(+)

✓ Merged 'add-user-profile-feature' into 'main'
✓ Removed worktree: ../convo-lab-worktrees/add-user-profile-feature
✓ Deleted branch: add-user-profile-feature

Merge successful! (commit: k10l11m)
```

## Alternative: Push Without Merging

If the user wants to push the branch without merging locally (e.g., to create a PR), suggest:
- `git push -u origin [branch-name]` (from within the worktree)
- Then they can create a PR and delete the worktree after it's merged remotely

## Error Handling

- If not in a git repository: "Error: Not in a git repository"
- If branch doesn't exist: "Error: Branch '[name]' not found"
- If uncommitted changes in current branch: "Error: Please commit or stash your changes first"
- If merge conflicts: "Merge conflicts detected. Resolve them manually, then run this command again"
- If trying to merge current branch: "Error: Cannot merge a branch into itself"
- If worktree doesn't exist but branch does: "Branch exists but has no worktree. Use regular git merge instead"
