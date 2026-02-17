# Quickstart: Admin User Import

## Goal
Import users via JSON or CSV from the Admin PWA users page with preflight and confirmation.

## Prerequisites
- Admin PWA running
- Admin user with user management permissions
- Target NPO selected in the Admin PWA

## Steps

1. Open the Admin PWA and navigate to the Users page.
2. Select the Import action.
3. Download or review the JSON or CSV example format.
4. Upload a JSON or CSV file.
5. Run preflight and review totals, warnings, and errors.
6. If preflight succeeds, confirm the import.
7. Verify created users, skipped users, and added memberships in the summary.

## Example JSON

[
  {
    "full_name": "Jordan Lee",
    "email": "jordan.lee@example.org",
    "role": "NPO Admin",
    "npo_identifier": "Hope Rising Foundation",
    "phone": "555-123-4567",
    "title": "Development Director"
  }
]

## Example CSV

full_name,email,role,npo_identifier,phone,title,password
Jordan Lee,jordan.lee@example.org,NPO Admin,Hope Rising Foundation,555-123-4567,Development Director,
