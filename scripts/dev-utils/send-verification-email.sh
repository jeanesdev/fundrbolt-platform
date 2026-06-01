#!/bin/bash

# Send a real verification email
# Usage: ./send-verification-email.sh your-email@example.com

EMAIL="${1}"

if [ -z "$EMAIL" ]; then
  echo "Usage: ./send-verification-email.sh your-email@example.com"
  exit 1
fi

API_URL="http://localhost:8000/api/v1"
TIMESTAMP=$(date +%s)
PASSWORD="TestPass123!"

echo "Registering user: $EMAIL"
echo ""

curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"first_name\": \"Test\",
    \"last_name\": \"User $TIMESTAMP\",
    \"phone\": \"+1234567890\"
  }" | jq '.'

echo ""
echo "📧 Verification email sent to: $EMAIL"
echo ""
echo "Check your inbox and click the verification link!"
echo ""
echo "Or use the token from the response above with:"
echo "  curl -X POST $API_URL/auth/verify-email \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"token\": \"YOUR_TOKEN\"}'"
echo ""
