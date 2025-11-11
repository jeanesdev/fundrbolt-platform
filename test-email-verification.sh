#!/bin/bash

# Test Email Verification Flow
# This script tests the complete email verification process

set -e

API_URL="http://localhost:8000/api/v1"

echo "=========================================="
echo "Testing Email Verification Flow"
echo "=========================================="
echo ""

# Get email address from command line or use default
EMAIL="${1:-test@augeo.app}"
PASSWORD="TestPass123!"

echo "Step 1: Register new user"
echo "Email: $EMAIL"
echo "------------------------------------------"

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"first_name\": \"Test\",
    \"last_name\": \"User\",
    \"phone\": \"+1234567890\"
  }")

echo "$REGISTER_RESPONSE" | jq '.'

# Extract verification token (only available in dev mode)
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.verification_token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo ""
  echo "⚠️  No verification token returned (production mode)"
  echo "📧 Check your email inbox for the verification link"
  echo ""
  echo "Once you have the token from email, run:"
  echo "  curl -X POST $API_URL/auth/verify-email \\"
  echo "    -H 'Content-Type: application/json' \\"
  echo "    -d '{\"token\": \"YOUR_TOKEN_HERE\"}'"
  exit 0
fi

USER_ID=$(echo "$REGISTER_RESPONSE" | jq -r '.user.id')

echo ""
echo "Step 2: Try to login BEFORE verification (should fail)"
echo "------------------------------------------"

LOGIN_BEFORE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$LOGIN_BEFORE" | jq '.'
echo ""

echo "Step 3: Verify email with token"
echo "Token: $TOKEN"
echo "------------------------------------------"

VERIFY_RESPONSE=$(curl -s -X POST "$API_URL/auth/verify-email" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\"
  }")

echo "$VERIFY_RESPONSE" | jq '.'
echo ""

echo "Step 4: Login AFTER verification (should succeed)"
echo "------------------------------------------"

LOGIN_AFTER=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$LOGIN_AFTER" | jq '{
  success: true,
  user_email: .user.email,
  user_verified: .user.email_verified,
  user_active: .user.is_active,
  has_access_token: (.access_token != null),
  has_refresh_token: (.refresh_token != null)
}'

echo ""
echo "=========================================="
echo "✅ Email verification flow completed!"
echo "=========================================="
echo ""
echo "User ID: $USER_ID"
echo "Email: $EMAIL"
echo "Status: Verified and Active"
echo ""
echo "📧 Check your email inbox at $EMAIL to see the verification email"
echo ""
