#!/bin/bash
# Manual pre-push check script
# Run this before pushing to catch issues early

set -e  # Exit on first error

echo "🚀 Running comprehensive pre-push checks..."
echo ""

# 1. Type checking
echo "1️⃣  Type checking..."
npm run type-check
echo "✅ Type check passed"
echo ""

# 2. Linting
echo "2️⃣  Linting..."
npm run lint
echo "✅ Lint passed"
echo ""

# 3. Format check
echo "3️⃣  Checking code formatting..."
npm run format:check
echo "✅ Format check passed"
echo ""

# 4. Build check
echo "4️⃣  Checking if project builds..."
npm run build > /dev/null 2>&1
echo "✅ Build passed"
echo ""

# 5. Run tests
echo "5️⃣  Running tests..."
npm run test:run
echo "✅ Tests passed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All checks passed! Safe to push to GitHub."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
