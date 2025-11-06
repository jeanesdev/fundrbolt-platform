#!/bin/bash

# Test NPO Member Invitation API
# This script helps debug API calls

echo "=== Testing NPO Member Invitation API ==="
echo ""

# Configuration
API_URL="http://localhost:8000/api/v1"
NPO_ID="your-npo-id-here"  # Replace with actual NPO ID
TOKEN="your-jwt-token-here"  # Replace with actual JWT token

echo "API URL: $API_URL"
echo "NPO ID: $NPO_ID"
echo ""

# Test 1: List members
echo "1. Testing GET /npos/{npo_id}/members"
echo "   Full URL: $API_URL/npos/$NPO_ID/members"
curl -X GET "$API_URL/npos/$NPO_ID/members" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "(no JSON response)"
echo ""
echo "---"
echo ""

# Test 2: Create invitation
echo "2. Testing POST /npos/{npo_id}/members (create invitation)"
echo "   Full URL: $API_URL/npos/$NPO_ID/members"
curl -X POST "$API_URL/npos/$NPO_ID/members" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "role": "staff"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s | jq '.' || echo "(no JSON response)"
echo ""
echo "---"
echo ""

echo "=== Debugging Tips ==="
echo ""
echo "1. Check browser console Network tab for actual request URLs"
echo "2. Look for the request payload to see what's being sent"
echo "3. Check the response status and error message"
echo "4. Verify JWT token is valid and user has permission"
echo ""
echo "Common Issues:"
echo "  - 401: Token expired or invalid"
echo "  - 403: User doesn't have permission (must be admin/co-admin)"
echo "  - 404: NPO ID not found or wrong URL"
echo "  - 405: Wrong HTTP method (POST vs GET)"
echo "  - 409: Email already a member or has pending invitation"
echo ""
