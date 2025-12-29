# Manual Testing Guide: Contact Feature (T081-T082)

**Feature**: 006-landing-page (Contact Form)
**Date**: 2025-11-07
**Tester**: ___________
**Environment**: Local Dev
**URLs**:
- Backend: http://localhost:8000
- Frontend: http://localhost:5175
- API Docs: http://localhost:8000/docs

---

## Pre-Testing Setup ✓

- [x] PostgreSQL running (port 5432)
- [x] Redis running (port 6379)
- [x] Backend running (port 8000)
- [x] Frontend running (port 5175)

---

## T081: Accessibility Audit

### 1. Keyboard Navigation Testing

**Test**: Navigate through entire contact form using only keyboard

**Steps**:
1. Open http://localhost:5175/contact
2. Press `Tab` repeatedly to move through form
3. Press `Shift+Tab` to move backwards

**Expected Results**:
- [ ] Focus indicator visible on all interactive elements
- [ ] Tab order is logical: Name → Email → Subject → Message → Submit button
- [ ] Hidden honeypot field should be skipped (not in tab order)
- [ ] Submit button activates with `Enter` or `Space` key
- [ ] Can navigate back through fields with Shift+Tab

**Actual Results**: ___________________________________________

---

### 2. Screen Reader Compatibility

**Test**: Use screen reader to navigate and submit form

**Tools**:
- **Windows**: NVDA (free) or JAWS
- **macOS**: VoiceOver (Cmd+F5)
- **Linux**: Orca

**Steps**:
1. Enable screen reader
2. Navigate to http://localhost:5175/contact
3. Tab through all form fields
4. Submit form with valid data

**Expected Results**:
- [ ] Screen reader announces all field labels correctly
- [ ] Required fields announced as "required"
- [ ] Error messages announced when validation fails
- [ ] Success message announced after submission
- [ ] Form structure (sections, headings) announced logically

**Actual Results**: ___________________________________________

---

### 3. Focus Management

**Test**: Verify focus behavior during form interactions

**Steps**:
1. Fill out form with invalid data (e.g., invalid email)
2. Click submit
3. Observe where focus moves

**Expected Results**:
- [ ] Focus remains on form or moves to first error
- [ ] Error messages have unique IDs linked via aria-describedby
- [ ] aria-invalid="true" set on fields with errors
- [ ] After successful submission, focus moves to success message or resets

**Actual Results**: ___________________________________________

---

### 4. Color Contrast & Visual Accessibility

**Test**: Verify text is readable and meets WCAG 2.1 AA standards

**Steps**:
1. Inspect page visually
2. Use browser DevTools contrast checker or WebAIM Contrast Checker
3. Test with different browser zoom levels (100%, 150%, 200%)

**Expected Results**:
- [ ] All text has 4.5:1 contrast ratio (normal text)
- [ ] Large text (18pt+) has 3:1 contrast ratio
- [ ] Form inputs have visible borders/outlines
- [ ] Error messages use color + icons/text (not color alone)
- [ ] Page remains readable at 200% zoom

**Actual Results**: ___________________________________________

---

### 5. ARIA Attributes Validation

**Test**: Verify proper ARIA attributes on form elements

**Steps**:
1. Open http://localhost:5175/contact
2. Open DevTools → Elements/Inspector
3. Inspect form fields

**Expected Results**:
- [ ] All inputs have `aria-invalid="false"` by default
- [ ] `aria-invalid="true"` when validation errors occur
- [ ] Error messages have unique IDs
- [ ] Inputs use `aria-describedby` to link to error messages
- [ ] Honeypot field has `aria-hidden="true"`
- [ ] Form has appropriate landmark roles (form, main, etc.)

**Actual Results**: ___________________________________________

---

### 6. Automated Accessibility Scan

**Test**: Run axe-core or similar tool

**Tools**:
- Browser extension: axe DevTools (Chrome/Firefox)
- CLI: `npm install -g @axe-core/cli && axe http://localhost:5175/contact`

**Steps**:
1. Install axe DevTools browser extension
2. Navigate to http://localhost:5175/contact
3. Open DevTools → axe DevTools tab
4. Click "Scan ALL of my page"

**Expected Results**:
- [ ] Zero critical violations
- [ ] Zero serious violations
- [ ] Minor violations documented and acceptable
- [ ] WCAG 2.1 AA compliance

**Actual Results**: ___________________________________________

---

## T082: Manual Functional Testing

### 1. Basic Form Submission (Happy Path)

**Test**: Submit valid contact form

**Steps**:
1. Navigate to http://localhost:5175/contact
2. Fill in form:
   - Name: "Jane Doe"
   - Email: "jane.doe@example.com"
   - Subject: "Question about pricing"
   - Message: "Hi, I'd like to know more about your pricing plans for nonprofits."
3. Click "Send Message"

**Expected Results**:
- [ ] Submit button shows "Sending..." during submission
- [ ] All form inputs disabled during submission
- [ ] Success message appears: "Thank you for your message! We'll get back to you as soon as possible."
- [ ] Form resets (all fields cleared)
- [ ] Submission stored in database with status='pending'
- [ ] Backend logs show submission (check terminal)

**Actual Results**: ___________________________________________

**Verify in database**:
```bash
docker exec -it fundrbolt_postgres psql -U fundrbolt_user -d fundrbolt_db -c "SELECT * FROM contact_submissions ORDER BY created_at DESC LIMIT 1;"
```

Expected fields: id, sender_name, sender_email, subject, message, ip_address, status='pending', created_at

---

### 2. Email Notification (Optional - requires email config)

**Test**: Verify email sent to support@fundrbolt.com

**Prerequisites**:
- Email configured in `.env` (SendGrid/ACS) OR
- MailHog running for local email testing

**Steps**:
1. If using MailHog: `docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog`
2. Update `.env`: `EMAIL_SMTP_HOST=localhost`, `EMAIL_SMTP_PORT=1025`
3. Restart backend
4. Submit contact form (see Test 1)
5. Check MailHog UI: http://localhost:8025

**Expected Results**:
- [ ] Email received at support@fundrbolt.com (or MailHog inbox)
- [ ] Email subject: "New Contact Form Submission: [Subject]"
- [ ] Email body includes: sender name, email, subject, message
- [ ] Submission status updated to 'processed' in database

**Actual Results**: ___________________________________________

**Note**: If email not configured, submission should still succeed with status='pending'

---

### 3. Validation Testing

**Test 3a**: Missing required fields

**Steps**:
1. Leave all fields empty
2. Click "Send Message"

**Expected Results**:
- [ ] Error messages appear for all required fields:
  - "Name is required"
  - "Email is required"
  - "Subject is required"
  - "Message is required"
- [ ] Form NOT submitted
- [ ] Error messages in red or highlighted
- [ ] aria-invalid="true" on all fields

**Actual Results**: ___________________________________________

---

**Test 3b**: Invalid email format

**Steps**:
1. Fill in form with invalid email: "not-an-email"
2. Click "Send Message"

**Expected Results**:
- [ ] Error message: "Please enter a valid email address"
- [ ] Form NOT submitted
- [ ] Email field highlighted with error

**Actual Results**: ___________________________________________

---

**Test 3c**: Name length validation

**Steps**:
1. Name too short: Enter "A" (1 character)
2. Click submit
3. Clear form
4. Name too long: Enter 101 characters (use repeat: "A".repeat(101))

**Expected Results**:
- [ ] Min length error: "Name must be at least 2 characters"
- [ ] Max length error: "Name must not exceed 100 characters"

**Actual Results**: ___________________________________________

---

**Test 3d**: Subject and message length

**Steps**:
1. Subject empty: Leave blank
2. Message empty: Leave blank
3. Click submit

**Expected Results**:
- [ ] Subject error: "Subject is required" or "Subject must not be empty"
- [ ] Message error: "Message is required" or "Message must not be empty"

**Actual Results**: ___________________________________________

---

### 4. Rate Limiting Testing

**Test**: Submit form 6 times in quick succession

**Steps**:
1. Fill out form with valid data
2. Submit form (1st time) → Should succeed
3. Wait 5 seconds, submit again (2nd time) → Should succeed
4. Repeat 4 more times (3rd, 4th, 5th, 6th submissions)
5. Observe 6th submission response

**Expected Results**:
- [ ] Submissions 1-5: Success messages
- [ ] Submission 6: Error message displayed
- [ ] Error text includes: "too many messages" or "5 per hour"
- [ ] Backend returns HTTP 429 (check DevTools Network tab)
- [ ] Rate limit resets after 1 hour

**Actual Results**: ___________________________________________

**Rate Limit Details**:
- Limit: 5 submissions per hour per IP address
- Window: Rolling 1-hour window
- Storage: Redis sorted sets

**Check Redis**:
```bash
docker exec -it fundrbolt_redis redis-cli KEYS "rate_limit:contact:*"
```

---

### 5. Honeypot Bot Detection

**Test**: Fill honeypot field (simulating bot behavior)

**Steps**:
1. Open http://localhost:5175/contact
2. Open DevTools → Console
3. Run: `document.querySelector('input[name="website"]').value = "http://spam.com"`
4. Fill out rest of form normally
5. Click "Send Message"

**Expected Results**:
- [ ] Error message: "Invalid form submission" or validation error
- [ ] Backend returns HTTP 422
- [ ] Submission NOT saved to database
- [ ] No email sent

**Actual Results**: ___________________________________________

---

### 6. Server Error Handling

**Test**: Simulate server error

**Steps**:
1. Stop backend: Ctrl+C in backend terminal
2. Fill out contact form
3. Click "Send Message"
4. Restart backend: `cd backend && poetry run uvicorn app.main:app --reload`

**Expected Results**:
- [ ] Error message displayed: "Failed to send message. Please try again."
- [ ] Form data preserved (not cleared)
- [ ] User can retry submission
- [ ] After backend restart, submission succeeds

**Actual Results**: ___________________________________________

---

### 7. Responsive Design Testing

**Test 7a**: Mobile (320px - 480px)

**Steps**:
1. Open DevTools → Toggle device toolbar (Ctrl+Shift+M)
2. Select "iPhone SE" or set custom width 375px
3. Navigate to contact page
4. Fill and submit form

**Expected Results**:
- [ ] All form fields stack vertically
- [ ] Labels and inputs full width
- [ ] Submit button full width
- [ ] Text remains readable (no horizontal scroll)
- [ ] Touch targets at least 44x44px
- [ ] No layout breaking or overlaps

**Actual Results**: ___________________________________________

---

**Test 7b**: Tablet (768px - 1024px)

**Steps**:
1. Set viewport to 768px width
2. Navigate to contact page

**Expected Results**:
- [ ] Form width appropriate (not too wide)
- [ ] Comfortable layout for tablet use
- [ ] Contact info and form may be side-by-side or stacked

**Actual Results**: ___________________________________________

---

**Test 7c**: Desktop (1920px+)

**Steps**:
1. Set viewport to 1920px width
2. Navigate to contact page

**Expected Results**:
- [ ] Form centered with max-width constraint
- [ ] White space balanced
- [ ] Contact info and form side-by-side
- [ ] Resource cards in grid (3 columns)

**Actual Results**: ___________________________________________

---

### 8. Content and Copy Verification

**Test**: Verify page content matches design

**Expected Elements**:
- [ ] Hero section heading: "Get in Touch"
- [ ] Hero subtitle mentions "questions about Fundrbolt"
- [ ] Contact information section heading: "Contact Information"
- [ ] Support email: support@fundrbolt.com
- [ ] Response time: "24-48 hours"
- [ ] Support hours: "Monday - Friday, 9am - 5pm PST"
- [ ] Resources section: "Looking for Something Specific?"
- [ ] 3 resource cards: Documentation, FAQs, Demo Request
- [ ] Icons displayed (📧, ⏰, 💬, 📚, 💡, 🎯)

**Actual Results**: ___________________________________________

---

### 9. Navigation and Links

**Test**: Verify all navigation links work

**Steps**:
1. Click "Contact" in navigation → Should stay on contact page
2. Click "Home" → Should go to landing page
3. Click "About" → Should go to about page
4. Click "Testimonials" → Should go to testimonials page
5. Check footer links

**Expected Results**:
- [ ] All navigation links work
- [ ] Current page highlighted in nav (if applicable)
- [ ] Footer includes contact link
- [ ] No broken links (404 errors)

**Actual Results**: ___________________________________________

---

### 10. Browser Compatibility Testing

**Test**: Test in multiple browsers

**Browsers to Test**:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if on macOS)

**Expected Results**:
- [ ] Form renders correctly in all browsers
- [ ] Validation works consistently
- [ ] Submission succeeds in all browsers
- [ ] Styling consistent (minor differences acceptable)

**Actual Results**: ___________________________________________

---

## Testing Summary

### Accessibility (T081)
- **Tests Completed**: _____ / 6
- **Critical Issues**: _____
- **Serious Issues**: _____
- **Minor Issues**: _____

### Functional (T082)
- **Tests Completed**: _____ / 10
- **Bugs Found**: _____
- **Blockers**: _____

### Overall Status
- [ ] **PASS** - Ready for production
- [ ] **PASS with Minor Issues** - Document issues, deploy anyway
- [ ] **FAIL** - Critical bugs, needs fixes before deployment

---

## Issues Found

| ID | Severity | Test | Description | Status |
|----|----------|------|-------------|--------|
| 1  |          |      |             |        |
| 2  |          |      |             |        |
| 3  |          |      |             |        |

---

## Notes

_Additional observations, edge cases, or recommendations:_

---

## Sign-Off

**Tester**: ___________
**Date**: ___________
**Approved by**: ___________
**Date**: ___________

---

## Quick Commands for Testing

### Check database for submissions:
```bash
docker exec -it fundrbolt_postgres psql -U fundrbolt_user -d fundrbolt_db -c "SELECT id, sender_name, sender_email, subject, status, created_at FROM contact_submissions ORDER BY created_at DESC LIMIT 5;"
```

### Check Redis rate limiting:
```bash
docker exec -it fundrbolt_redis redis-cli KEYS "rate_limit:contact:*"
docker exec -it fundrbolt_redis redis-cli ZRANGE "rate_limit:contact:127.0.0.1" 0 -1 WITHSCORES
```

### Clear rate limit (for retesting):
```bash
docker exec -it fundrbolt_redis redis-cli DEL "rate_limit:contact:127.0.0.1"
```

### Check backend logs:
```bash
# Look for contact submission logs in backend terminal
```

### Start MailHog (for email testing):
```bash
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
# Then view emails at http://localhost:8025
```
