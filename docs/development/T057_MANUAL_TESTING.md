# T057: Manual Testing Guide - Testimonials Feature

**Credentials**: `super_admin@test.com` / `SuperAdmin123!`

## Quick Start

### 1. Open the Testimonials Page

<http://localhost:3001/testimonials>
🌐 **URL**: <http://localhost:3001/testimonials>

**Note**: The landing-site frontend runs on port 3001, while augeo-admin runs on port 5173.

### 2. Basic Functionality Checklist

#### ✅ Page Load

- [ ] Page loads without errors (check browser console F12)
- [ ] Hero section displays "What Our Community Says"
- [ ] 5 testimonials display in grid layout
- [ ] Filter buttons visible: All, Donors, Auctioneers, NPO Admins
- [ ] CTA section at bottom with registration links

#### ✅ Filter Testing

- [ ] Click "Donors" → Shows only donor testimonials (should see 2)
- [ ] Click "Auctioneers" → Shows only auctioneer (should see 1)
- [ ] Click "NPO Admins" → Shows only NPO admins (should see 2)
- [ ] Click "All" → Shows all 5 testimonials again

- [ ] Active filter button has visual highlight

#### ✅ Testimonial Cards

- [ ] Each card shows quote text
- [ ] Author name displayed
- [ ] Role badge shows with correct color
- [ ] Organization name visible (for NPO admins/auctioneers)

- [ ] Avatar circle with initials displays
- [ ] Cards have hover effect

#### ✅ Responsive Design

Open DevTools (F12) → Toggle Device Toolbar (Ctrl+Shift+M)

- [ ] **Mobile (375px)**: Single column layout, filters work
- [ ] **Tablet (768px)**: 2-column grid layout
- [ ] **Desktop (1280px+)**: 3-column grid layout

#### ✅ Accessibility (Quick Check)

- [ ] Press Tab key → Focus visible on all interactive elements
- [ ] Tab order is logical (filters → cards → CTA links)
- [ ] Enter key activates filter buttons
- [ ] No console errors or warnings

---

## Admin API Testing (via curl)

### Setup: Get Auth Token

```bash
# Run this first to get your admin token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \

  -d '{"email": "super_admin@test.com", "password": "SuperAdmin123!"}' \
  | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])")

echo "Token: ${TOKEN:0:30}..."
```

### Test 1: Create Testimonial

```bash
curl -X POST http://localhost:8000/api/v1/admin/testimonials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_tet": "Manual test: This platform is amazing for our fundraising events!",

    "author_name": "Jane Smith",
    "author_role": "donor",
    "display_o<http://localhost:3001/testimonials>
    "is_published": true
  }' | python3 -m json.tool

```

**Expected**:

- [ ] Returns 201 status
- [ ] Response includes UUID `id` field
- [ ] Refresh <http://localhost:3001/testimonials> → New testimonial appears

### Test 2: Update Testimonial

```bash
# Save the ID from previous step
TESTIMONIAL_ID="<paste-uuid-here>"

curl -X PATCH http://localhost:8000/api/v1/admin/testimonials/$TESTIMONIAL_ID \

  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_text": "UPDATED: This testimonial has been modified!",
    "author_role": "auctioneer",

    "organization_name": "Smith Auction Co."
  }' | python3 -m json.tool
```

**Expected**:

- [ ] Returns 200 status
- [ ] Updated fields in response

- [ ] Refresh page → Changes visible

### Test 3: Unpublish Testimonial

```bash
curl -X PATCH http://localhost:8000/api/v1/admin/testimonials/$TESTIMONIAL_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_published": false}' | python3 -m json.tool
```

**Expected**:

- [ ] Returns 200 status
- [ ] Refresh page → Testimonial no longer visible

### Test 4: Delete Testimonial

```bash
curl -X DELETE http://localhost:8000/api/v1/admin/testimonials/$TESTIMONIAL_ID \
  -H "Authorization: Bearer $TOKEN" -v
```

**Expected**:

- [ ] Returns 204 No Content
- [ ] Testimonial permanently removed from public view

---

## Automated Test Script

Run all API tests automatically:

```bash
cd /home/jjeanes/augeo-platform
./docs/development/QUICK_TEST_COMMANDS.sh
```

<http://localhost:5173/testimonials>
This script will:

1. ✅ Check services (PostgreSQL, Redis)
2. ✅ Login as admin

3. ✅ List current testimonials
4. ✅ Create test testimonial
5. ✅ Update testimonial
6. ✅ Verify on public API
7. ✅ Test role filters
8. ✅ Delete test testimonial

---

## Browser Testing Workflow

### Option 1: Use Existing Testimonials

<http://localhost:3001/testimonials>

1. Open <http:<http://localhost:8000/docs>als>
2. Test filters, r<http://localhost:8000/health>ity
3. Check browser console for errors

### Option 2: Full CRUD Testing

1. Run automated script: `./docs/development/QUICK_TEST_COMMANDS.sh`
2. Open browser to see changes live
3. Test each operation:
   - Create → See new testimonial appear
   - Filter → Verify filtering works
   - Update → See changes reflect
   - Delete → Testimonial disappears

---

## Quick Reference

**Frontend (Landing Site)**: <http://localhost:3001/testimonials>
**API Docs**: <http://localhost:8000/docs>
**Health Check**: <http://localhost:8000/health>

**Admin Credentials**: `super_admin@test.com` / `SuperAdmin123!`

**Test Dat**: 5 published testimonials

- 2 NPO Admins (Sarah Johnson, Robert Williams)
- 1 Auctioneer (Jennifer Martinez)

---

## Issues/Notes

| Issue | Description | Status |
|-------|-------------|--------|
|       |             |        |

---

## Sign-Off

**Manual Testing Complete**: ☐ Yes ☐ No
**Date**: ___________
**Notes**:
