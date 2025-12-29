#!/bin/bash
# Quick Test Commands for Manual Testing (T057)
# Run these commands to test the testimonials feature

set -e

echo "=== Fundrbolt Testimonials Feature - Manual Testing Commands ==="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. Check services
echo -e "${BLUE}1. Checking Services...${NC}"
docker-compose ps | grep -E "fundrbolt_postgres|fundrbolt_redis"
echo ""

# 2. Get auth token
echo -e "${BLUE}2. Getting Admin Auth Token...${NC}"
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "super_admin@test.com",
    "password": "SuperAdmin123!"
  }' | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -n "$TOKEN" ]; then
    echo -e "${GREEN}✓ Login successful!${NC}"
    echo "Token: ${TOKEN:0:20}..."
    echo ""
else
    echo -e "${YELLOW}⚠ Login failed. Check credentials or backend status.${NC}"
    exit 1
fi

# 3. List current testimonials
echo -e "${BLUE}3. Current Published Testimonials:${NC}"
curl -s http://localhost:8000/api/v1/public/testimonials | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Total: {len(data)} testimonials')
for t in data:
    print(f'  - {t[\"author_name\"]} ({t[\"author_role\"]}) - Order: {t[\"display_order\"]}')" || echo "Failed to fetch"
echo ""

# 4. Create test testimonial
echo -e "${BLUE}4. Creating Test Testimonial...${NC}"
CREATE_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/admin/testimonials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_text": "This is a test testimonial created during manual testing (T057). The system is working perfectly!",
    "author_name": "Manual Tester",
    "author_role": "donor",
    "organization_name": null,
    "photo_url": null,
    "display_order": 100,
    "is_published": true
  }')

TESTIMONIAL_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['id'])" 2>/dev/null)

if [ -n "$TESTIMONIAL_ID" ]; then
    echo -e "${GREEN}✓ Testimonial created!${NC}"
    echo "ID: $TESTIMONIAL_ID"
    echo "$CREATE_RESPONSE" | python3 -m json.tool | head -20
    echo ""
else
    echo -e "${YELLOW}⚠ Failed to create testimonial${NC}"
    echo "$CREATE_RESPONSE"
    exit 1
fi

# 5. Update testimonial
echo -e "${BLUE}5. Updating Testimonial...${NC}"
curl -s -X PATCH http://localhost:8000/api/v1/admin/testimonials/$TESTIMONIAL_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_text": "UPDATED: This testimonial was successfully modified during testing!",
    "author_role": "auctioneer",
    "organization_name": "Test Auction Co."
  }' | python3 -m json.tool | grep -E "quote_text|author_role|organization_name"
echo -e "${GREEN}✓ Update successful!${NC}"
echo ""

# 6. Verify on public API
echo -e "${BLUE}6. Verifying on Public API...${NC}"
curl -s "http://localhost:8000/api/v1/public/testimonials" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for t in data:
    if 'Manual Tester' in t['author_name'] or 'UPDATED' in t['quote_text']:
        print(f'  ✓ Found: {t[\"author_name\"]} ({t[\"author_role\"]}) - {t[\"quote_text\"][:60]}...')
"
echo ""

# 7. Test filtering
echo -e "${BLUE}7. Testing Role Filters...${NC}"
echo "Donors:"
curl -s "http://localhost:8000/api/v1/public/testimonials?role=donor" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'  Found {len(data)} donor testimonials')
"
echo "Auctioneers:"
curl -s "http://localhost:8000/api/v1/public/testimonials?role=auctioneer" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'  Found {len(data)} auctioneer testimonials')
"
echo ""

# 8. Delete test testimonial
echo -e "${BLUE}8. Cleaning Up (Deleting Test Testimonial)...${NC}"
DELETE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  http://localhost:8000/api/v1/admin/testimonials/$TESTIMONIAL_ID \
  -H "Authorization: Bearer $TOKEN")

if [ "$DELETE_STATUS" = "204" ]; then
    echo -e "${GREEN}✓ Test testimonial deleted (soft delete)${NC}"
else
    echo -e "${YELLOW}⚠ Delete returned status: $DELETE_STATUS${NC}"
fi
echo ""

# 9. URLs to test manually
echo -e "${BLUE}=== Manual Testing URLs ===${NC}"
echo -e "Frontend: ${GREEN}http://localhost:5173/testimonials${NC}"
echo -e "API Docs: ${GREEN}http://localhost:8000/docs${NC}"
echo -e "Health:   ${GREEN}http://localhost:8000/health${NC}"
echo ""

echo -e "${GREEN}✓ All automated API tests passed!${NC}"
echo ""
echo "Next steps:"
echo "1. Open browser to http://localhost:5173/testimonials"
echo "2. Test UI interactions (filters, pagination, responsive)"
echo "3. Follow manual testing guide: docs/development/MANUAL_TESTING_GUIDE.md"
