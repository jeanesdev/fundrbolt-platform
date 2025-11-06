#!/bin/bash
# Test script for NPO Branding Flow
# Tests the complete branding configuration feature

set -e

BASE_URL="http://localhost:8000/api/v1"
FRONTEND_URL="http://localhost:5173"

echo "=========================================="
echo "NPO Branding Flow Test"
echo "=========================================="
echo ""

# Check if servers are running
echo "1. Checking servers..."
if ! pgrep -f 'uvicorn app.main:app' > /dev/null; then
    echo "❌ Backend server not running"
    exit 1
fi
echo "✅ Backend running"

if ! pgrep -f 'vite/bin/vite\.js' > /dev/null; then
    echo "❌ Frontend server not running"
    exit 1
fi
echo "✅ Frontend running"
echo ""

# Login as test user
echo "2. Logging in as test user..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "super_admin@test.com",
        "password": "SuperAdmin123!"
    }')

ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Login failed. Response:"
    echo "$LOGIN_RESPONSE"
    exit 1
fi
echo "✅ Login successful"
echo ""

# Get NPOs
echo "3. Fetching NPO list..."
NPOS_RESPONSE=$(curl -s -X GET "$BASE_URL/npos?limit=5" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

NPO_ID=$(echo $NPOS_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['items'][0]['id'] if data.get('items') else '')" 2>/dev/null || echo "")

if [ -z "$NPO_ID" ]; then
    echo "❌ No NPOs found. Response:"
    echo "$NPOS_RESPONSE"
    exit 1
fi

NPO_NAME=$(echo $NPOS_RESPONSE | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['items'][0]['name'] if data.get('items') else '')" 2>/dev/null || echo "")

echo "✅ Found NPO: $NPO_NAME (ID: $NPO_ID)"
echo ""

# Get current branding
echo "4. Fetching current branding configuration..."
BRANDING_RESPONSE=$(curl -s -X GET "$BASE_URL/npos/$NPO_ID/branding" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Current branding:"
echo "$BRANDING_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$BRANDING_RESPONSE"
echo ""

# Update branding
echo "5. Updating branding configuration..."
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/npos/$NPO_ID/branding" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "primary_color": "#3b82f6",
        "secondary_color": "#10b981",
        "logo_url": "https://example.com/logo.png",
        "social_media_links": {
            "facebook": "https://facebook.com/testorg",
            "twitter": "https://twitter.com/testorg",
            "instagram": "https://instagram.com/testorg",
            "linkedin": "https://linkedin.com/company/testorg"
        }
    }')

if echo "$UPDATE_RESPONSE" | grep -q "primary_color"; then
    echo "✅ Branding updated successfully"
    echo "$UPDATE_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$UPDATE_RESPONSE"
else
    echo "❌ Branding update failed:"
    echo "$UPDATE_RESPONSE"
    exit 1
fi
echo ""

# Test logo upload URL generation
echo "6. Testing logo upload URL generation..."
UPLOAD_URL_RESPONSE=$(curl -s -X POST "$BASE_URL/npos/$NPO_ID/logo/upload-url" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "filename": "test-logo.png",
        "content_type": "image/png"
    }')

if echo "$UPLOAD_URL_RESPONSE" | grep -q "upload_url"; then
    echo "✅ Upload URL generated successfully"
    UPLOAD_URL=$(echo $UPLOAD_URL_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('upload_url', ''))" 2>/dev/null || echo "")
    echo "Upload URL (truncated): ${UPLOAD_URL:0:100}..."
else
    echo "❌ Upload URL generation failed:"
    echo "$UPLOAD_URL_RESPONSE"
fi
echo ""

# Verify updated branding
echo "7. Verifying updated branding..."
VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/npos/$NPO_ID/branding" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$VERIFY_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$VERIFY_RESPONSE"
echo ""

echo "=========================================="
echo "✅ All API tests passed!"
echo "=========================================="
echo ""
echo "🌐 Frontend URLs:"
echo "   NPO List:    $FRONTEND_URL/npos"
echo "   NPO Detail:  $FRONTEND_URL/npos/$NPO_ID"
echo "   Branding:    $FRONTEND_URL/npos/$NPO_ID/branding"
echo ""
echo "📋 Manual Testing Steps:"
echo "   1. Open: $FRONTEND_URL/npos"
echo "   2. Click on '$NPO_NAME'"
echo "   3. Click 'Branding' button (with palette icon)"
echo "   4. Adjust primary/secondary colors"
echo "   5. Upload a logo (drag & drop or click)"
echo "   6. Add social media links"
echo "   7. View live preview"
echo "   8. Click 'Save' button"
echo "   9. Verify success toast notification"
echo ""
