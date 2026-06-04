# API Contracts — 048 Attendee Profile Survey

All admin routes require authentication. Donor routes require donor-level auth (event registration).

---

## Admin — Event Survey Config

### GET /api/v1/admin/events/{event_id}/survey
Get the event's survey configuration (creates default if none exists).

**Response 200:**
```json
{
  "id": "uuid",
  "event_id": "uuid",
  "is_active": false,
  "modal_prompt_title": "Tell us about yourself",
  "modal_prompt_body": "Complete this survey to earn $20 off your event checkout!",
  "discount_cents": 2000,
  "questions": [
    {
      "id": "uuid",
      "text": "Which part of our mission matters most to you?",
      "display_order": 0,
      "is_active": true,
      "options": [
        { "id": "uuid", "text": "Program A", "display_order": 0 },
        { "id": "uuid", "text": "Program B", "display_order": 1 }
      ]
    }
  ]
}
```

### PATCH /api/v1/admin/events/{event_id}/survey
Update survey config settings (prompt, discount, active state).

**Request:**
```json
{
  "is_active": true,
  "modal_prompt_title": "Tell us about yourself",
  "modal_prompt_body": "Complete this survey to earn $20 off!",
  "discount_cents": 2000
}
```
**Response 200:** Same shape as GET.

### POST /api/v1/admin/events/{event_id}/survey/seed-defaults
Populate the survey with the 8 default questions (clears existing questions first if empty). Returns 409 if questions already exist.

**Response 200:**
```json
{ "questions_added": 8 }
```

### POST /api/v1/admin/events/{event_id}/survey/copy-from/{source_event_id}
Copy questions from another event's survey. Replaces existing questions. Discount resets to 0.

**Response 200:**
```json
{ "questions_copied": 8 }
```

---

## Admin — Survey Questions

### POST /api/v1/admin/events/{event_id}/survey/questions
Add a new question.

**Request:**
```json
{
  "text": "Have you supported this cause before?",
  "display_order": 5,
  "options": [
    { "text": "First time", "display_order": 0 },
    { "text": "Attended before", "display_order": 1 }
  ]
}
```
**Response 201:** Full question object with options.

### PATCH /api/v1/admin/events/{event_id}/survey/questions/{question_id}
Update a question's text, order, active state, or options.

**Request (partial):**
```json
{
  "text": "Updated question text",
  "is_active": true,
  "display_order": 2,
  "options": [
    { "id": "existing-uuid", "text": "Updated option", "display_order": 0 },
    { "text": "New option", "display_order": 1 }
  ]
}
```
**Response 200:** Full question object.

### DELETE /api/v1/admin/events/{event_id}/survey/questions/{question_id}
Hard-delete a question. Returns 409 if responses already exist for this event.

**Response 204:** No content.

---

## Donor — Survey

### GET /api/v1/donor/events/{event_id}/survey/status
Check if the survey modal should be shown for the current user.

**Response 200:**
```json
{
  "should_show": true,
  "survey": {
    "id": "uuid",
    "modal_prompt_title": "Tell us about yourself",
    "modal_prompt_body": "Complete this survey to earn $20 off!",
    "discount_cents": 2000,
    "questions": [
      {
        "id": "uuid",
        "text": "Which part of our mission matters most to you?",
        "display_order": 0,
        "options": [
          { "id": "uuid", "text": "Program A", "display_order": 0 }
        ]
      }
    ]
  }
}
```
`should_show: false` when: survey is inactive, no questions, already completed/skipped.

### POST /api/v1/donor/events/{event_id}/survey/response
Submit survey answers (complete) or skip.

**Request — complete:**
```json
{
  "action": "complete",
  "answers": [
    {
      "question_id": "uuid",
      "option_id": "uuid"
    }
  ]
}
```

**Request — skip:**
```json
{
  "action": "skip"
}
```

**Response 200:**
```json
{
  "status": "completed",
  "discount_cents_applied": 2000,
  "suggested_label_ids": ["uuid", "uuid"]
}
```
`suggested_label_ids` is empty array when skipped or no labels matched.

---

## Admin — Donor Dashboard Extensions

### GET /api/v1/admin/donor-dashboard/donors/{user_id} (extended)
Existing endpoint extended to include survey data in response.

**Additional fields in `DonorProfileResponse`:**
```json
{
  "survey_responses": [
    {
      "event_id": "uuid",
      "event_name": "Gala 2025",
      "status": "completed",
      "completed_at": "2025-10-25T19:30:00Z",
      "discount_cents_applied": 2000,
      "answers": [
        {
          "question_text": "Which part of our mission matters most to you?",
          "option_text": "Families served"
        }
      ],
      "suggested_labels": [
        { "id": "uuid", "name": "Heart Driven", "color": "#DC2626" }
      ]
    }
  ],
  "donor_labels": [
    {
      "id": "uuid",
      "name": "Heart Driven",
      "color": "#DC2626",
      "is_suggested": false,
      "source": "manual"
    }
  ]
}
```

### GET /api/v1/admin/donor-dashboard/leaderboard (extended)
Existing endpoint extended to include label count columns.

**Additional fields per `DonorLeaderboardItem`:**
```json
{
  "donor_labels": [
    { "id": "uuid", "name": "Heart Driven", "color": "#DC2626", "is_suggested": true }
  ],
  "survey_completed": true
}
```

---

## Admin — Donor Label Suggestion Confirmation

### PATCH /api/v1/admin/npos/{npo_id}/donor-labels/users/{user_id}/confirm-suggestions
Confirm all pending `is_suggested=true` assignments, changing them to `is_suggested=false, source='manual'`.

**Response 200:**
```json
{ "confirmed": 2 }
```

### GET /api/v1/admin/npos/{npo_id}/donor-labels (extended)
Include `is_system_default` in label response.

**Additional field:**
```json
{ "is_system_default": true }
```
