# Event Management Manual Testing Guide

## 🚀 Quick Start

### Services Status
- ✅ Backend API: http://localhost:8000
- ✅ Frontend: http://localhost:5173
- ✅ PostgreSQL: Running (Docker)
- ✅ Redis: Running (Docker)

### Test Credentials
```
NPO Admin:    npo_admin@test.com / NpoAdmin123!
Super Admin:  super_admin@test.com / SuperAdmin123!
```

### Test NPO ID
```
f6a01f90-8940-4aa7-9274-8742a1cc868e
```

---

## 📋 Testing Checklist

### 1. Authentication & Navigation

- [x] **Login**
  - Navigate to http://localhost:5173
  - Login with `npo_admin@test.com` / `NpoAdmin123!`
  - Verify successful authentication

- [x] **Sidebar Navigation**
  - Check that "Events" link appears in sidebar (Calendar icon)
  - Click "Events" link
  - Verify navigation to `/events` route
  - Verify URL: http://localhost:5173/events

### 2. Event List Page (`/events`)

#### Empty State
- [x] **No Events Yet**
  - Verify "No events found" message displays
  - Verify "Create Your First Event" button appears
  - Click button → should navigate to `/events/create`

#### With Events
- [ ] **Status Tabs**
  - Create an event first (see Test 3)
  - Verify tabs: All | Draft | Active | Closed
  - Check event counts in parentheses (e.g., "Draft (2)")
  - Click each tab, verify filtering works

- [ ] **Status Filter Dropdown**
  - Click status filter dropdown
  - Verify options: All Events, Draft, Active, Closed
  - Select each option, verify list updates

- [ ] **Event Cards**
  - Verify each card shows:
    - Event name (bold, large text)
    - Tagline (smaller gray text)
    - Date/time with timezone
    - Venue name and address
    - Status badge (gray=draft, green=active, red=closed)
  - Verify action buttons:
    - "Edit" (always visible)
    - "Publish" (draft only)
    - "Close" (active only)

- [ ] **Publish Event**
  - Click "Publish" on draft event
  - Verify confirmation dialog appears
  - Confirm → verify toast: "Event published successfully"
  - Verify status badge changes to green "Active"
  - Verify "Publish" button disappears

- [ ] **Close Event**
  - Click "Close" on active event
  - Verify confirmation dialog appears
  - Confirm → verify toast: "Event closed successfully"
  - Verify status badge changes to red "Closed"
  - Verify "Close" button disappears

### 3. Event Create Page (`/events/create`)

#### Navigation
- [x] **Access Create Page**
  - Click "Create Your First Event" or "+ Create Event" button
  - Verify navigation to `/events/create`
  - Verify page header: "Create Event"
  - Verify back button appears

#### Form - Basic Information
- [ ] **Event Name** (Required)
  - Leave blank → submit → verify error: "Name must be at least 3 characters"
  - Enter "Test Event 1"
  - Verify character counter updates

- [ ] **Slug** (Auto-generated)
  - Leave blank (should auto-generate from name)
  - Enter custom slug: "my-custom-slug"
  - Verify accepts lowercase, numbers, hyphens

- [ ] **Tagline** (Optional)
  - Enter: "Join us for an amazing event!"
  - Verify max 200 characters enforced

- [ ] **Description** (Optional)
  - Click "Edit" tab in RichTextEditor
  - Enter markdown:
    ```markdown
    # Welcome!

    **Bold text** and *italic text*

    - Bullet point 1
    - Bullet point 2
    ```
  - Click "Preview" tab
  - Verify markdown renders correctly (heading, bold, italic, bullets)

#### Form - Date, Time & Location
- [ ] **Event Date & Time** (Required)
  - Leave blank → submit → verify error
  - Select future date/time using datetime picker
  - Verify format: YYYY-MM-DDTHH:mm

- [ ] **Timezone** (Required)
  - Leave blank → submit → verify error
  - Select "America/New_York"
  - Verify dropdown includes common timezones

- [ ] **Venue Name** (Optional)
  - Enter: "Community Center"

- [ ] **Venue Address** (Optional)
  - Enter: "123 Main St, Anytown, USA"

- [ ] **Venue City, State, ZIP** (Optional)
  - Enter city: "Anytown"
  - Enter state: "CA"
  - Enter zip: "12345"

#### Form - Branding Colors
- [ ] **Primary Color**
  - Click color picker
  - Select color (e.g., blue)
  - Verify hex input updates
  - Manually enter hex: `#FF5733`
  - Verify color picker updates

- [ ] **Secondary Color**
  - Test same as primary color

- [ ] **Background Color**
  - Test same as primary color

- [ ] **Accent Color**
  - Test same as primary color

#### Form Submission
- [ ] **Cancel Button**
  - Click "Cancel"
  - Verify navigation back to `/events`

- [ ] **Create Event**
  - Fill all required fields (name, date/time, timezone)
  - Click "Create Event"
  - Verify loading state (button disabled, spinner)
  - Verify toast: "Event created successfully!"
  - **CRITICAL**: Verify navigation to `/events/{event-id}/edit`
  - Verify event ID in URL

### 4. Event Edit Page (`/events/{id}/edit`)

#### Navigation
- [ ] **Access Edit Page**
  - From event list, click "Edit" button
  - Verify navigation to `/events/{event-id}/edit`
  - Verify page header shows event name
  - Verify status badge displays current status

#### Tab 1: Details
- [ ] **Load Existing Data**
  - Verify all form fields pre-populated with saved data
  - Verify colors display correctly in color pickers

- [ ] **Update Event**
  - Change event name: "Updated Test Event"
  - Change tagline
  - Update description in RichTextEditor
  - Click "Update Event"
  - Verify toast: "Event updated successfully"
  - Refresh page → verify changes persisted

- [ ] **Optimistic Locking**
  - Open event edit page in two browser tabs/windows
  - Tab 1: Change name to "Version 1", save
  - Tab 2: Change name to "Version 2", save
  - Verify Tab 2 shows error: "Event was modified by another user"
  - Click "Refresh" to reload latest version

#### Tab 2: Media
- [ ] **Upload File**
  - Click "Browse files" or drag-and-drop area
  - Select image file (PNG, JPG, or PDF)
  - Verify file appears in upload queue
  - Verify progress bar shows upload progress
  - Verify status changes: Uploaded → Scanning → Approved
  - **Note**: Virus scanning is placeholder (Celery not set up)

- [ ] **File Validation**
  - Try uploading file > 10MB
  - Verify error: "File size exceeds 10MB limit"
  - Try uploading invalid type (.txt)
  - Verify error: "Invalid file type"

- [ ] **Delete Media**
  - Click trash icon on uploaded file
  - Verify confirmation dialog
  - Confirm → verify file removed
  - Verify toast: "Media deleted successfully"

#### Tab 3: Links
- [ ] **Add Link**
  - Fill form:
    - Type: "Website"
    - URL: "https://example.com"
    - Title: "Event Website"
    - Description: "Visit our website"
  - Click "Add Link"
  - Verify link appears in list
  - Verify toast: "Link added successfully"

- [ ] **Link Validation**
  - Try invalid URL: "not-a-url"
  - Verify error: "Invalid URL format"

- [ ] **Delete Link**
  - Click "Delete" on link
  - Verify confirmation dialog
  - Confirm → verify link removed

#### Tab 4: Food Options
- [ ] **Add Food Option**
  - Fill form:
    - Name: "Vegetarian"
    - Description: "Plant-based meals"
    - Icon: "🥗"
  - Click "Add"
  - Verify option appears in list
  - Verify toast: "Food option added"

- [ ] **Delete Food Option**
  - Click "Delete" on food option
  - Verify confirmation dialog
  - Confirm → verify option removed

#### Cancel Button
- [ ] **Cancel Changes**
  - Make changes to event
  - Click "Cancel"
  - Verify navigation back to `/events` list
  - Verify changes NOT saved

### 5. API Integration Testing

#### Backend API Calls
- [ ] **Open Browser DevTools**
  - Open Console tab
  - Open Network tab → filter by "Fetch/XHR"

- [ ] **Create Event**
  - Create new event
  - Verify API call: `POST /api/v1/events`
  - Check request body includes: npo_id, name, event_datetime, timezone
  - Check response: 201 Created, includes event ID

- [ ] **Update Event**
  - Update event details
  - Verify API call: `PATCH /api/v1/events/{event_id}`
  - Check request includes `version` field (optimistic locking)
  - Check response: 200 OK, includes updated `version`

- [ ] **Publish Event**
  - Publish draft event
  - Verify API call: `POST /api/v1/events/{event_id}/publish`
  - Check response: status changes to "active"

- [ ] **Upload Media**
  - Upload file
  - Verify 3 API calls:
    1. `POST /api/v1/events/{event_id}/media/upload-url` (get presigned URL)
    2. `PUT {azure-blob-url}` (direct upload to Azure)
    3. `POST /api/v1/events/{event_id}/media/{media_id}/confirm` (confirm upload)

- [ ] **List Events**
  - Load events list page
  - Verify API call: `GET /api/v1/events?page=1&page_size=20`
  - Check response includes pagination: total, page, page_size, total_pages

### 6. Error Handling

- [ ] **Network Errors**
  - Stop backend server: `pkill -f uvicorn`
  - Try creating/updating event
  - Verify error toast displays
  - Restart backend: `cd backend && poetry run uvicorn app.main:app --reload`

- [ ] **Validation Errors**
  - Submit form with missing required fields
  - Verify red error messages under fields
  - Verify form doesn't submit

- [ ] **404 Not Found**
  - Navigate to `/events/00000000-0000-0000-0000-000000000000/edit`
  - Verify error message or redirect

### 7. Edge Cases

- [ ] **Long Event Names**
  - Create event with 200+ character name
  - Verify displays correctly in list/cards

- [ ] **Special Characters**
  - Event name: `Test & "Event" <2024>`
  - Verify renders safely (no XSS)

- [ ] **Past Event Dates**
  - Create event with past date
  - Verify accepts (no frontend validation blocking past dates)

- [ ] **Many Events**
  - Create 25+ events
  - Verify pagination works (page_size=20)
  - Verify scroll/performance acceptable

---

## 🐛 Known Issues / TODOs

### Expected Issues (Not Implemented Yet)
1. **NPO Context**: Event create uses hardcoded `npoId = 'temp-npo-id'`
   - **Impact**: Events created with invalid NPO ID will fail
   - **Workaround**: None - requires auth context integration

2. **Virus Scanning**: Media status stuck on "scanning"
   - **Impact**: Files won't show "approved" status
   - **Workaround**: Requires Celery + ClamAV setup (Phase 4)

3. **Background Tasks**: Event auto-close not working
   - **Impact**: Events won't auto-close after end date
   - **Workaround**: Requires Celery Beat setup (Phase 4)

4. **Role-Based Access**: Events visible to all authenticated users
   - **Impact**: Sidebar shows Events to non-NPO users
   - **Workaround**: Requires NPO context + role filtering

### Phase 4 Features (Not Implemented)
- Media upload/delete API endpoints (using placeholders)
- Event links API endpoints (using placeholders)
- Food options API endpoints (using placeholders)
- Celery integration for async tasks

---

## 📊 Test Results Template

### Test Session: [Date]
**Tester**: [Your Name]
**Environment**: Development
**Browser**: [Chrome/Firefox/Safari + Version]

#### Results Summary
- ✅ Authentication & Navigation: PASS
- ✅ Event List Page: PASS
- ✅ Event Create Page: PASS
- ✅ Event Edit Page: PASS
- ✅ API Integration: PASS
- ⚠️  Known Issues: As expected

#### Issues Found
1. [Issue description]
   - **Steps to reproduce**:
   - **Expected**:
   - **Actual**:
   - **Severity**: Critical/High/Medium/Low

---

## 🔧 Troubleshooting

### Frontend Not Loading
```bash
# Check if frontend is running
ss -tuln | grep 5173

# If not, start it
cd frontend/augeo-admin
pnpm dev
```

### Backend Not Responding
```bash
# Check if backend is running
curl http://localhost:8000/health

# If not, start it
cd backend
poetry run uvicorn app.main:app --reload
```

### Database Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# View backend logs
tail -f /tmp/backend.log

# Run migrations
cd backend
poetry run alembic upgrade head
```

### Clear Test Data
```bash
# Reset database (WARNING: Deletes all data)
cd backend
poetry run alembic downgrade base
poetry run alembic upgrade head
poetry run python seed_test_users.py
```

---

## 📝 Notes

- **Session Duration**: Access tokens expire after 15 minutes
- **Auto-refresh**: Frontend automatically refreshes tokens
- **Logout**: If stuck, clear localStorage and re-login
- **CORS**: Backend configured for localhost:5173

**Good luck testing! 🚀**
