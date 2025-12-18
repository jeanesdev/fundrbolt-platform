# Manual Testing Guide - Testimonials Feature

**Date**: November 6, 2025
**Feature**: Phase 3 - Testimonials (T057)
**Tester**: Ready for manual testing

## Prerequisites ✅

All services are running:
- ✅ PostgreSQL: `localhost:5432` (healthy)
- ✅ Redis: `localhost:6379` (healthy)
- ✅ Backend API: `http://localhost:8000` (healthy)
- ✅ Frontend: `http://localhost:5173`

Test data: **5 published testimonials** available (2 donors, 2 NPO admins, 1 auctioneer)

---

## Test Plan Overview

### 1. Public Testimonials Page (User View)
### 2. Admin Testimonial Management (Admin CRUD)
### 3. Cross-Browser & Responsive Testing
### 4. Accessibility Testing

---

## 1. Public Testimonials Page Testing

### 1.1 Initial Page Load
**URL**: `http://localhost:5173/testimonials`

**Test Steps**:
1. Open browser to testimonials page
2. Verify page loads without errors
3. Check browser console for JavaScript errors (should be none)

**Expected Results**:
- [ ] Page loads in < 2 seconds
- [ ] Hero section displays with heading "What Our Community Says"
- [ ] Filter buttons visible: "All", "Donors", "Auctioneers", "NPO Admins"
- [ ] Testimonial cards displayed in grid (3 columns on desktop)
- [ ] CTA section at bottom with "Register Your Organization" and "Learn More" links
- [ ] No console errors

---

### 1.2 Filter Functionality

**Test: Filter by "Donors"**
1. Click "Donors" button
2. Observe filtered results

**Expected Results**:
- [ ] "Donors" button has active styling (aria-pressed="true")
- [ ] Only testimonials with role "donor" displayed
- [ ] Should see 2 donor testimonials (Michael Chen, Emily Davis)
- [ ] Other filter buttons return to inactive state

**Test: Filter by "Auctioneers"**
1. Click "Auctioneers" button
2. Observe filtered results

**Expected Results**:
- [ ] "Auctioneers" button has active styling
- [ ] Only 1 testimonial displayed (Jennifer Martinez)
- [ ] Correct role badge shows "Auctioneer"

**Test: Filter by "NPO Admins"**
1. Click "NPO Admins" button
2. Observe filtered results

**Expected Results**:
- [ ] "NPO Admins" button has active styling
- [ ] 2 NPO admin testimonials displayed (Sarah Johnson, Robert Williams)
- [ ] Organization names visible under author names

**Test: Return to "All"**
1. Click "All" button
2. Observe results

**Expected Results**:
- [ ] All 5 testimonials displayed again
- [ ] "All" button has active styling
- [ ] Testimonials in correct display_order (1-5)

---

### 1.3 Pagination Controls

**Note**: With only 5 testimonials and 6 per page, pagination buttons should be disabled.

**Test Steps**:
1. Locate pagination section below testimonial grid
2. Check Previous/Next buttons

**Expected Results**:
- [ ] Pagination navigation visible with role="navigation"
- [ ] "Previous" button is disabled (cursor-not-allowed)
- [ ] "Next" button is disabled
- [ ] Page indicator shows "Page 1 of 1"
- [ ] Buttons have proper aria-labels

**Test: Create more testimonials to test pagination**
(This will be tested in Admin CRUD section)

---

### 1.4 Testimonial Card Display

**Test Steps**:
1. Inspect each testimonial card
2. Verify all components render correctly

**Expected Results for Each Card**:
- [ ] Quote text displays in full (blockquote element)
- [ ] Author name visible and bold
- [ ] Role badge displays with correct color:
  - Donor: purple/blue
  - Auctioneer: green
  - NPO Admin: orange
- [ ] Organization name shows (for NPO admins and auctioneers)
- [ ] Avatar fallback displays (colored circle with initials)
- [ ] Card has hover effect (shadow/elevation)
- [ ] Semantic HTML: `<article>` wrapper

---

### 1.5 Loading & Error States

**Test: Loading State**
1. Open browser DevTools → Network tab
2. Throttle network to "Slow 3G"
3. Refresh page
4. Observe loading state

**Expected Results**:
- [ ] Loading spinner displays with aria-live="polite"
- [ ] "Loading testimonials..." text visible
- [ ] No layout shift when content loads

**Test: Error State**
1. Stop backend server: `pkill -f 'uvicorn app.main:app'`
2. Refresh testimonials page
3. Observe error state

**Expected Results**:
- [ ] Error message displays with role="alert"
- [ ] Red error styling
- [ ] Message: "Failed to load testimonials. Please try again later."
- [ ] No testimonial cards visible

4. Restart backend: `cd backend && poetry run uvicorn app.main:app --reload`

**Test: Empty State**
(Would require database manipulation - skip for now)

---

### 1.6 Call-to-Action Section

**Test Steps**:
1. Scroll to bottom of page
2. Locate CTA section
3. Test both links

**Expected Results**:
- [ ] H2 heading: "Ready to Transform Your Fundraising Events?"
- [ ] Descriptive text about getting started
- [ ] "Register Your Organization" button (primary styling)
- [ ] "Learn More" link (secondary styling)
- [ ] Links have proper href attributes (check DevTools):
  - Register: `/register` or similar
  - Learn More: `/about` or similar

---

### 1.7 SEO & Metadata

**Test Steps**:
1. View page source (Ctrl+U)
2. Check `<head>` section

**Expected Results**:
- [ ] `<title>` tag: "What Our Community Says | Fundrbolt"
- [ ] Meta description present
- [ ] Open Graph tags (og:title, og:description) if configured
- [ ] Proper semantic HTML5 structure

---

## 2. Admin Testimonial Management

### 2.1 Authentication Setup

**Get Admin Credentials**:
```bash
cd backend
poetry run python -c "
from app.core.database import get_db
from app.models.user import User
db = next(get_db())
admin = db.query(User).filter(User.role == 'super_admin', User.is_active == True).first()
print(f'Email: {admin.email}')
print('Password: Check seed_test_users.py or reset password')
"
```

**Default Test User** (from seed_test_users.py):
- Email: `superadmin@fundrbolt.app`
- Password: `SuperAdmin123!`

---

### 2.2 Admin Login

**Test Steps**:
1. Navigate to login page (exact URL may vary)
2. Enter superadmin credentials
3. Login

**Expected Results**:
- [ ] Successful login
- [ ] Redirected to admin dashboard
- [ ] Access token stored (check DevTools → Application → Local Storage)

---

### 2.3 Create New Testimonial (POST)

**API Endpoint**: `POST /api/v1/admin/testimonials`

**Test using curl**:
```bash
# First, get auth token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "superadmin@fundrbolt.app",
    "password": "SuperAdmin123!"
  }' | python3 -m json.tool | grep '"access_token"' | cut -d'"' -f4)

# Create testimonial
curl -X POST http://localhost:8000/api/v1/admin/testimonials \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_text": "Manual testing testimonial - this is a test quote created during T057 manual testing phase.",
    "author_name": "John Tester",
    "author_role": "donor",
    "organization_name": null,
    "photo_url": null,
    "display_order": 10,
    "is_published": true
  }' | python3 -m json.tool
```

**Expected Results**:
- [ ] 201 Created response
- [ ] Testimonial JSON returned with UUID
- [ ] New testimonial visible on public page (refresh `/testimonials`)
- [ ] Testimonial appears when filtering by "Donors"

---

### 2.4 Update Testimonial (PATCH)

**Test Steps**:
```bash
# Get testimonial ID from previous step or list all
TESTIMONIAL_ID="<uuid-from-previous-step>"

# Update the testimonial
curl -X PATCH http://localhost:8000/api/v1/admin/testimonials/$TESTIMONIAL_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_text": "UPDATED: This testimonial has been modified during manual testing.",
    "author_role": "auctioneer",
    "organization_name": "Test Auction House"
  }' | python3 -m json.tool
```

**Expected Results**:
- [ ] 200 OK response
- [ ] Updated fields reflected in response
- [ ] Changes visible on public page after refresh
- [ ] Role filter works with new role ("Auctioneers")

---

### 2.5 Unpublish Testimonial (PATCH)

**Test Steps**:
```bash
curl -X PATCH http://localhost:8000/api/v1/admin/testimonials/$TESTIMONIAL_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_published": false
  }' | python3 -m json.tool
```

**Expected Results**:
- [ ] 200 OK response
- [ ] `is_published: false` in response
- [ ] Testimonial no longer visible on public page
- [ ] Total count decreases by 1

---

### 2.6 Delete Testimonial (DELETE)

**Test Steps**:
```bash
curl -X DELETE http://localhost:8000/api/v1/admin/testimonials/$TESTIMONIAL_ID \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

**Expected Results**:
- [ ] 204 No Content response
- [ ] Testimonial soft-deleted (deleted_at timestamp set)
- [ ] Testimonial not visible in public API
- [ ] Record still exists in database (soft delete)

---

### 2.7 Authorization Tests

**Test: Non-admin cannot access admin endpoints**
```bash
# Login as regular user (if available) or use invalid token
curl -X GET http://localhost:8000/api/v1/admin/testimonials \
  -H "Authorization: Bearer invalid_token"
```

**Expected Results**:
- [ ] 401 Unauthorized response
- [ ] Error message about authentication

**Test: Admin can access all endpoints**
- [ ] GET /api/v1/admin/testimonials (list all, including unpublished)
- [ ] POST /api/v1/admin/testimonials (create)
- [ ] PATCH /api/v1/admin/testimonials/:id (update)
- [ ] DELETE /api/v1/admin/testimonials/:id (delete)

---

## 3. Responsive Design Testing

### 3.1 Mobile View (320px - 480px)

**Test Steps**:
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone SE" or set custom width: 375px

**Expected Results**:
- [ ] Single column layout (1 testimonial per row)
- [ ] Filter buttons stack or scroll horizontally
- [ ] Text remains readable (no overflow)
- [ ] Touch targets are at least 44x44px
- [ ] No horizontal scrolling
- [ ] Images/avatars scale appropriately

---

### 3.2 Tablet View (768px - 1024px)

**Test Steps**:
1. Set viewport to iPad (768px) or iPad Pro (1024px)

**Expected Results**:
- [ ] 2-column grid layout
- [ ] Filter buttons display inline
- [ ] Spacing and padding appropriate
- [ ] CTA section maintains good proportions

---

### 3.3 Desktop View (1280px+)

**Test Steps**:
1. Set viewport to 1920px (Full HD)

**Expected Results**:
- [ ] 3-column grid layout
- [ ] Maximum content width maintained (container max-width)
- [ ] Testimonial cards don't stretch too wide
- [ ] Good whitespace distribution

---

## 4. Accessibility Testing

### 4.1 Keyboard Navigation

**Test Steps**:
1. Load testimonials page
2. Press Tab repeatedly to navigate through interactive elements
3. Use Enter/Space to activate buttons

**Expected Results**:
- [ ] Focus visible on all interactive elements (outline/ring)
- [ ] Tab order is logical: filters → cards → pagination → CTA links
- [ ] Enter key activates filter buttons
- [ ] No keyboard traps
- [ ] Skip link available (if implemented)

---

### 4.2 Screen Reader Testing (Optional)

**Tools**: NVDA (Windows), JAWS, or VoiceOver (Mac)

**Test Steps**:
1. Enable screen reader
2. Navigate through page
3. Listen to announcements

**Expected Results**:
- [ ] Page title announced
- [ ] Headings identified (H1, H2, H3)
- [ ] Filter buttons announce state ("pressed" or "not pressed")
- [ ] Testimonial content read in logical order
- [ ] Role badges announced
- [ ] Loading state announced ("Loading testimonials...")
- [ ] Error state announced as alert

---

### 4.3 Color Contrast

**Test Steps**:
1. Use browser extension: WAVE, axe DevTools, or Lighthouse
2. Check contrast ratios

**Expected Results**:
- [ ] All text meets WCAG AA contrast (4.5:1 for normal text)
- [ ] Interactive elements meet 3:1 contrast
- [ ] Focus indicators visible
- [ ] Role badges have sufficient contrast

---

### 4.4 ARIA Attributes

**Test Steps**:
1. Inspect elements in DevTools
2. Verify ARIA attributes

**Expected Results**:
- [ ] Filter section has `role="group"` and `aria-label="Filter testimonials by role"`
- [ ] Filter buttons have `aria-pressed` (true/false)
- [ ] Pagination has `role="navigation"` and `aria-label="Testimonials pagination"`
- [ ] Loading spinner has `aria-live="polite"`
- [ ] Error alerts have `role="alert"` and `aria-live="assertive"`

---

## 5. Performance Testing

### 5.1 Load Time

**Test Steps**:
1. Open DevTools → Network tab
2. Refresh page
3. Check "Load" time

**Expected Results**:
- [ ] First Contentful Paint < 1.5s
- [ ] Time to Interactive < 3s
- [ ] Total page size < 1MB

---

### 5.2 API Response Time

**Test Steps**:
```bash
time curl -s http://localhost:8000/api/v1/public/testimonials > /dev/null
```

**Expected Results**:
- [ ] API responds in < 200ms
- [ ] Database query optimized (no N+1 queries)

---

## 6. Edge Cases & Error Handling

### 6.1 Invalid Role Filter

**Test Steps**:
```bash
curl "http://localhost:8000/api/v1/public/testimonials?role=invalid_role"
```

**Expected Results**:
- [ ] 422 Unprocessable Entity
- [ ] Validation error message

---

### 6.2 Negative Pagination

**Test Steps**:
```bash
curl "http://localhost:8000/api/v1/public/testimonials?skip=-1&limit=-10"
```

**Expected Results**:
- [ ] 422 Unprocessable Entity
- [ ] Validation error for skip/limit

---

### 6.3 Large Pagination Limit

**Test Steps**:
```bash
curl "http://localhost:8000/api/v1/public/testimonials?limit=99999"
```

**Expected Results**:
- [ ] 422 Unprocessable Entity or capped at max limit
- [ ] No database performance issues

---

## Testing Checklist Summary

### Public Page (User View)
- [ ] Page loads successfully
- [ ] All 5 testimonials display correctly
- [ ] Filter buttons work (All, Donors, Auctioneers, NPO Admins)
- [ ] Pagination controls present (disabled with < 6 testimonials)
- [ ] Loading state displays correctly
- [ ] Error state handles API failures
- [ ] CTA links present and functional
- [ ] Mobile responsive (320px, 768px, 1280px)

### Admin Management
- [ ] Login as superadmin successful
- [ ] Create new testimonial (POST)
- [ ] Update testimonial (PATCH)
- [ ] Unpublish testimonial
- [ ] Delete testimonial (soft delete)
- [ ] Authorization: non-admin blocked (401/403)

### Accessibility
- [ ] Keyboard navigation functional
- [ ] Focus indicators visible
- [ ] ARIA attributes correct
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader compatible (optional)

### Performance
- [ ] Page load < 3 seconds
- [ ] API response < 200ms
- [ ] No console errors
- [ ] Smooth filtering/pagination

---

## Issues Found

**Document any bugs or issues here**:

| Issue # | Description | Severity | Status |
|---------|-------------|----------|--------|
| | | | |

---

## Sign-Off

**Tested By**: _________________
**Date**: _________________
**Status**: ☐ Pass ☐ Fail ☐ Pass with Issues

**Notes**:
