# Pull Request Command

Create a pull request with a comprehensive description and test plan.

## Instructions

1. **Check Prerequisites**:
   - Verify that `gh` CLI is installed and authenticated (`gh auth status`)
   - If not authenticated, run `gh auth login` to authenticate
   - Confirm the current branch is not `main` or `master`
   - Ensure all changes are committed (clean working tree)

2. **Analyze Branch Changes**:
   - Run `git status` to verify clean working tree
   - Run `git log main..HEAD --oneline` (or `master..HEAD`) to see all commits in this branch
   - Run `git diff main...HEAD --stat` to see file change statistics
   - Run `git diff main...HEAD` to see the actual changes (if needed for context)
   - Get the current branch name with `git branch --show-current`

3. **Generate PR Title**:
   - Create a clear, concise title that summarizes the entire PR
   - Use conventional commit style prefixes where appropriate (feat, fix, refactor, test, docs, etc.)
   - Keep it under 72 characters
   - Example: "Add comprehensive data-testid attributes for Playwright E2E testing"

4. **Generate PR Description**:
   - Create a comprehensive description with the following sections:

   ```markdown
   ## Summary

   [High-level overview of what this PR does]

   - **Feature Area 1**: Description of changes
   - **Feature Area 2**: Description of changes
   - **Feature Area 3**: Description of changes

   ## Test plan

   - [ ] Test case 1
   - [ ] Test case 2
   - [ ] Test case 3
   - [ ] Test case 4

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   ```

   **Summary section guidelines**:
   - Provide context on what problem this PR solves or feature it adds
   - Break down changes by logical feature areas or components
   - Be specific about what was changed, added, or fixed
   - Keep bullet points concise but informative

   **Test plan guidelines**:
   - Create actionable, specific test cases
   - Cover main functionality changes
   - Include edge cases or important scenarios
   - Make them checkable tasks (use `- [ ]` format)
   - Aim for 5-10 test cases that comprehensively cover the changes

5. **Create the Pull Request**:
   - Use the `gh pr create` command with title and body
   - Use a heredoc to pass the body for proper formatting:
   ```bash
   gh pr create --title "PR title here" --body "$(cat <<'EOF'
   [PR description here]
   EOF
   )"
   ```
   - Return the PR URL to the user

6. **Handle Errors**:
   - If `gh` is not installed, instruct user to install it or offer to install with `brew install gh`
   - If not authenticated, run `gh auth login` interactively
   - If on main/master branch, warn the user they need to be on a feature branch
   - If working tree is dirty, prompt to commit changes first

## Example Output

After creating the PR, show the user:
- The PR URL
- A brief summary of what was included
- Confirmation that the PR is ready for review

## Notes

- This command should work from any git repository
- The PR will be created against the default branch (usually `main` or `master`)
- If you want to target a different base branch, you can add `--base <branch-name>` to the `gh pr create` command
- Make sure to analyze ALL commits in the branch, not just the most recent one
