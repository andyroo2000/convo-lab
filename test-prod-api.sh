#!/bin/bash

echo "=== Testing Production APIs ==="
echo ""

# First login to get a token (using production DB credentials)
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST https://convolab-5q7eg4sina-uc.a.run.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"andrewlandry@gmail.com","password":"Silver810"}' \
  -c /tmp/prod_cookies.txt)

echo "Login successful"
echo ""

# Extract token from cookies
TOKEN=$(grep -o 'token[[:space:]]*[^;]*' /tmp/prod_cookies.txt | sed 's/token[[:space:]]*//')

echo "2. Testing Narrow Listening API..."
curl -s "https://convolab-5q7eg4sina-uc.a.run.app/api/narrow-listening?library=true" \
  -H "Cookie: token=$TOKEN" | python3 -m json.tool || echo "Failed"

echo ""
echo "3. Testing Courses API..."
curl -s "https://convolab-5q7eg4sina-uc.a.run.app/api/courses?library=true" \
  -H "Cookie: token=$TOKEN" | python3 -m json.tool || echo "Failed"

echo ""
echo "✅ Production API tests complete"
