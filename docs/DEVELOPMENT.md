# Development Workflow Guide

This guide covers the development workflow for ConvoLab, including git workflows, worktree management, and best practices.

## Development Environment

### Prerequisites
- See [SETUP.md](./SETUP.md) for installation instructions
- Git configured with your name and email
- GitHub CLI (`gh`) installed and authenticated
- Familiarity with TypeScript and React

### Project Structure
```
convo-lab/
├── client/          # React frontend (Vite)
├── server/          # Express backend (TypeScript)
├── shared/          # Shared types and utilities
├── docs/            # Documentation
└── .claude/         # Claude Code slash commands
    └── commands/    # Custom workflow commands
```

## Git Workflow

### Branching Strategy
We use a simple main-based workflow with feature branches:

- `main` - Production-ready code, always deployable
- `feature/*` - New features
- `fix/*` - Bug fixes
- `refactor/*` - Code improvements

### Creating a New Feature

**Option 1: Using Worktrees (Recommended for Parallel Work)**

Use git worktrees when you want to work on multiple features simultaneously without switching branches.

```bash
# Create a new worktree for your feature
/new-worktree feature/add-user-profile

# This creates a new directory and checks out a new branch
# You can now work on this feature independently
```

**Option 2: Traditional Branching**

```bash
git checkout -b feature/add-user-profile
```

### Making Changes

1. **Make your changes** - Edit code, add features, fix bugs
2. **Test locally** - Run tests and verify changes work
3. **Commit changes** - Use our `/commit` command (see below)

### Committing Changes

We use the `/commit` slash command for consistent, well-documented commits:

```bash
# Make your changes
# When ready to commit:
/commit
```

The `/commit` command will:
- Analyze your changes
- Generate a conventional commit message
- Update the CHANGELOG.md
- Push to GitHub automatically

**Conventional Commit Prefixes:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks
- `perf:` - Performance improvements

### Creating Pull Requests

Use the `/pr` command to create well-formatted pull requests:

```bash
# On your feature branch with committed changes:
/pr
```

The `/pr` command will:
- Analyze all commits in your branch
- Generate a comprehensive PR description
- Create test plan checklist
- Open the PR on GitHub
- Return the PR URL

**PR Description Format:**
```markdown
## Summary

[What this PR does]

- **Feature Area 1**: Changes made
- **Feature Area 2**: Changes made

## Test plan

- [ ] Test case 1
- [ ] Test case 2
- [ ] Test case 3
```

### Code Review Process

1. **Open PR** - Use `/pr` command
2. **Request Review** - Tag team members
3. **Address Feedback** - Make requested changes
4. **Get Approval** - At least one approval required
5. **Merge** - Squash and merge to keep history clean

## Worktree Management

Worktrees allow you to work on multiple branches simultaneously without switching contexts.

### Available Commands

#### `/new-worktree [branch-name]`
Create a new worktree for parallel development.

```bash
/new-worktree feature/dashboard-redesign
```

This creates:
- New directory: `../convo-lab-worktrees/feature/dashboard-redesign`
- New branch checked out
- Independent working directory

#### `/list-worktrees`
See all active worktrees.

```bash
/list-worktrees
```

Output:
```
main                     (main worktree)
feature/dashboard        ../convo-lab-worktrees/feature/dashboard
fix/login-bug           ../convo-lab-worktrees/fix/login-bug
```

#### `/switch-worktree`
Switch between worktrees interactively.

```bash
/switch-worktree
```

#### `/delete-worktree [branch-name]`
Delete a specific worktree with smart merge detection.

```bash
/delete-worktree feature/dashboard-redesign
```

Features:
- Automatically detects if branch is merged
- No confirmation needed for merged branches
- Prompts for unmerged branches
- Cleans up local and remote branches

#### `/prune-worktrees`
Automatically clean up all merged worktrees at once.

```bash
/prune-worktrees
```

This command:
- Fetches latest from origin
- Finds all merged branches via GitHub API
- Deletes merged worktrees and branches automatically
- Shows summary of what was cleaned up

**When to use:**
- After PRs are merged
- Periodic cleanup to keep workspace tidy
- Before starting new work

#### `/merge-worktree`
Merge worktree changes back to main.

```bash
/merge-worktree feature/my-feature
```

### Worktree Best Practices

**When to Use Worktrees:**
- Working on multiple features simultaneously
- Need to quickly switch contexts
- Testing different approaches in parallel
- Maintaining long-running feature branches

**When NOT to Use Worktrees:**
- Simple bug fixes (use regular branches)
- Sequential work on single feature
- Quick experiments

**Cleanup Workflow:**
```bash
# After your PR is merged, clean up automatically
/prune-worktrees

# Or delete specific worktree
/delete-worktree feature/my-merged-feature
```

## Development Commands

### Server Development

```bash
# Start server in watch mode
npm run dev:server

# Run server tests
npm run test:server

# Type check
npm run type-check

# Database migrations
cd server
npx prisma migrate dev
npx prisma studio  # View database
```

### Client Development

```bash
# Start client dev server
npm run dev:client

# Build for production
npm run build:client

# Preview production build
npm run preview:client
```

### Full Stack

```bash
# Run both client and server
npm run dev

# Build everything
npm run build

# Run all tests
npm run test
```

## Testing Guidelines

### Unit Tests
- Test individual functions and components
- Mock external dependencies
- Aim for >80% coverage

### Integration Tests
- Test API endpoints
- Test database operations
- Use test database

### E2E Tests (Playwright)
We use `data-testid` attributes for reliable E2E testing:

```tsx
// In components:
<button data-testid="auth-button-login">Login</button>

// In tests:
await page.click('[data-testid="auth-button-login"]');
```

## Code Style

### TypeScript
- Use strict mode
- Define interfaces for all data structures
- Avoid `any`, use `unknown` if needed
- Use type inference where obvious

### React
- Functional components only
- Use hooks appropriately
- Keep components small and focused
- Extract reusable logic to custom hooks

### Naming Conventions
- Components: `PascalCase`
- Files: `PascalCase.tsx` for components, `camelCase.ts` for utilities
- Functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- CSS classes: `kebab-case`

## Debugging

### Server Debugging
```bash
# Enable debug logs
DEBUG=* npm run dev:server

# Check logs
tail -f server/logs/app.log
```

### Client Debugging
- Use React DevTools
- Check browser console
- Use Network tab for API calls

### Database Debugging
```bash
# View data
npx prisma studio

# Check migrations
npx prisma migrate status

# Reset database (CAUTION)
npx prisma migrate reset
```

## Common Workflows

### Adding a New Feature

1. Create worktree: `/new-worktree feature/my-feature`
2. Implement feature with tests
3. Commit: `/commit`
4. Create PR: `/pr`
5. Address review feedback
6. After merge, cleanup: `/prune-worktrees`

### Fixing a Bug

1. Create branch: `git checkout -b fix/bug-name`
2. Fix bug and add test
3. Commit: `/commit`
4. Create PR: `/pr`
5. After merge: `git checkout main && git pull`

### Updating Dependencies

```bash
# Check for updates
npm outdated

# Update specific package
npm update package-name

# Update all packages (be careful)
npm update
```

### Database Schema Changes

```bash
# 1. Edit schema.prisma
# 2. Create migration
npx prisma migrate dev --name add_user_avatar

# 3. Commit migration
/commit

# 4. Push changes
# Migration will run automatically in production
```

## Deployment

### Staging
Pushes to `main` automatically deploy to staging:
```
https://convo-lab-staging.run.app
```

### Production
Use the deployment script:
```bash
./deploy.sh
```

Or manually:
```bash
gcloud builds submit --config cloudbuild.yaml
```

## Troubleshooting

### "Module not found" errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Prisma client out of sync
```bash
cd server
npx prisma generate
```

### Port conflicts
```bash
# Kill process on port
lsof -ti:3001 | xargs kill
```

### Git worktree issues
```bash
# List all worktrees
git worktree list

# Remove stuck worktree
git worktree remove path/to/worktree --force

# Clean up refs
git worktree prune
```

## Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [Setup Guide](./SETUP.md)
- [Getting Started](./GETTING_STARTED.md)
- [API Documentation](./API.md)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Git Worktrees](https://git-scm.com/docs/git-worktree)

## Getting Help

- Check existing GitHub issues
- Review error logs carefully
- Ask in team Slack channel
- Pair program with team member

## Contributing

1. Follow this workflow guide
2. Write tests for new features
3. Update documentation
4. Use `/commit` and `/pr` commands
5. Be responsive to PR feedback
6. Keep commits focused and atomic

Happy coding! 🚀
