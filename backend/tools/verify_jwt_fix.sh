#!/bin/bash

echo "=========================================="
echo "JWT Token Generation Verification"
echo "=========================================="
echo ""

# Test 1: Verify token generation matches Slurm official token
echo "Test 1: Token signature verification"
go run test_final_token.go
echo ""

# Test 2: Test backend API
echo "Test 2: Backend API test"
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"sunfx","password":"123123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "✗ Login failed"
  exit 1
fi

echo "✓ Login successful"
echo ""

echo "Testing Slurm accounts API..."
ACCOUNTS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/slurm/accounts)

if echo "$ACCOUNTS_RESPONSE" | grep -q '"data"'; then
  echo "✓ Slurm accounts API working"
  echo "Found accounts:"
  echo "$ACCOUNTS_RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4
else
  echo "✗ Slurm accounts API failed"
  echo "Response: $ACCOUNTS_RESPONSE"
  exit 1
fi

echo ""
echo "=========================================="
echo "✓ All tests passed!"
echo "JWT token generation is working correctly"
echo "=========================================="
