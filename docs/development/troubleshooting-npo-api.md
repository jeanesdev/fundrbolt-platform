# Troubleshooting: Network Error on Organizations Page

## Summary

You're seeing network errors on the Organizations page because the API endpoints require authentication. The backend is working correctly, but you need to be logged in.

## Diagnosis

✅ Backend server is running on <http://localhost:8000>
✅ Frontend dev server is running on <http://localhost:5173>
✅ NPO API endpoints exist and are working
✅ Database has 5 NPO organizations seeded
✅ API requires authentication (returns 401 without token)

## Solution

### Option 1: Log in with Demo Accounts

The seed script created demo users with password `demo123`:

**Super Admin** (can see all NPOs):

- Email: `superadmin@augeo.app`
- Password: `demo123`

**NPO Admins** (can see their own NPOs):

- `sarah.admin@hopefoundation.org` - Hope Foundation (Approved)
- `james.admin@greenearthinitiative.org` - Green Earth Initiative (Pending Approval)
- `dr.maria@communityhealthnetwork.org` - Community Health Network (Approved)
- `alex.admin@youthartsacademy.org` - Youth Arts Academy (Draft)
- `jennifer.admin@animalrescuealliance.org` - Animal Rescue Alliance (Rejected)

All passwords: `demo123`

### Steps to Resolve

1. **Open the frontend** at <http://localhost:5173>
2. **Sign in** with one of the accounts above
3. **Navigate to Organizations** page at <http://localhost:5173/npos>
4. **You should now see the NPO list** without network errors

### Option 2: Check Authentication Status

If you're already logged in but still seeing errors:

1. **Open browser DevTools** (F12)
2. **Go to Console tab** - Check for specific error messages
3. **Go to Network tab** - Look at the failed `/npos` request
4. **Go to Application/Storage tab** - Check if `auth-store` exists in localStorage

### Common Issues

#### Issue: "Authentication required" (401)

**Solution**: You're not logged in. Use one of the demo accounts above.

#### Issue: "Consent required" (409)

**Solution**: You need to accept updated legal documents. This should show a modal prompting you to accept.

#### Issue: CORS error

**Solution**: Backend CORS is configured for <http://localhost:5173>. If you're accessing from a different URL, update the CORS settings in `backend/app/core/config.py`.

#### Issue: Token expired

**Solution**: Log out and log back in. The refresh token logic should handle this automatically, but you can manually clear localStorage and re-login.

## Verify Setup

Run this command to verify everything is working:

```bash
./debug-npo-api.sh
```

## API Endpoints

The NPO API endpoints are available at:

- `GET /api/v1/npos` - List NPOs (paginated, with filters)
- `POST /api/v1/npos` - Create new NPO
- `GET /api/v1/npos/{id}` - Get NPO details
- `PATCH /api/v1/npos/{id}` - Update NPO
- `DELETE /api/v1/npos/{id}` - Delete NPO (soft delete)
- `PATCH /api/v1/npos/{id}/status` - Update NPO status (admin only)

All endpoints require authentication via Bearer token in the Authorization header.

## Expected Behavior After Login

Once logged in with the super admin account, you should see:

- **Hope Foundation** - Approved, 3 members
- **Green Earth Initiative** - Pending Approval, 2 members
- **Community Health Network** - Approved, 4 members
- **Youth Arts Academy** - Draft, 1 member
- **Animal Rescue Alliance** - Rejected, 2 members

## Next Steps

1. Log in with `superadmin@augeo.app` / `demo123`
2. View the Organizations page - should load successfully
3. Click on any organization to see details
4. Try filtering by status (Approved, Pending, Draft, Rejected)
5. Try searching by organization name

## If Still Having Issues

Check the browser console (F12 → Console) for the exact error message and share it for further troubleshooting.
