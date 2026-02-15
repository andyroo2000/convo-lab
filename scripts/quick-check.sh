#!/bin/bash
# Quick check script - runs faster checks only
# Use this for a rapid pre-push sanity check

set -e

echo "⚡ Running quick pre-push checks..."
echo ""

# Type checking only (fastest way to catch most issues)
echo "📋 Type checking..."
npm run type-check
echo "✅ Type check passed"
echo ""

# Lint check
echo "🔍 Linting..."
npm run lint
echo "✅ Lint passed"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Quick checks passed!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "💡 For full checks including build and tests, run: ./scripts/pre-push-check.sh"
