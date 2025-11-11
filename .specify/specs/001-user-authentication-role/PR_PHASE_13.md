# Phase 13: Organization and Address Fields

## Overview
Add optional organization name and structured address fields to user profiles, enabling users representing businesses or institutions to provide detailed organizational information during registration and profile management.

## Changes Summary
- **24 files changed**, 1,430 insertions(+), 54 deletions(-)
- **2 database migrations** for schema evolution
- **7 new backend tests** for comprehensive validation
- **Complete API documentation** with examples

## What's Changed

### Database Schema (Migrations)
- ✅ **Migration 008**: Added `organization_name` (VARCHAR 255) and `organization_address` (TEXT) columns
- ✅ **Migration 009**: Restructured address into 6 structured components:
  - `address_line1` (VARCHAR 255)
  - `address_line2` (VARCHAR 255)
  - `city` (VARCHAR 100)
  - `state` (VARCHAR 100)
  - `postal_code` (VARCHAR 20)
  - `country` (VARCHAR 100)
- ✅ All fields nullable with proper indexing for `organization_name`

### Backend Implementation
#### Models & Schemas
- Updated `User` model with 7 new optional fields
- Enhanced `UserCreate`, `UserUpdate`, `UserPublic` schemas
- Added `Field(max_length=X)` validation for all string fields

#### Services
- `AuthService.register()`: Accepts and stores organization/address during registration
- `UserService.update_user()`: Handles address field updates with empty string → NULL conversion
- Added `build_user_response()` helper for consistent API responses

#### API Endpoints
- `POST /api/v1/auth/register`: Accepts optional organization and address fields
- `POST /api/v1/users`: Admins can create users with organization details
- `PATCH /api/v1/users/{user_id}`: Update organization and address fields
- All endpoints return complete user objects with address fields

### Frontend Implementation
- **SignUpForm**: Added 7 optional input fields with proper validation
- **UsersActionDialog**: Create/edit users with organization and address
- **TypeScript Types**: Updated `User`, `UserCreate`, `UserUpdate` interfaces
- **API Service**: Updated `users-api.ts` with new fields
- **Schema Validation**: Added Zod schemas for address fields

### Testing (7 New Tests - All Passing ✅)
#### Integration Tests
- `test_register_with_organization_and_address_fields()`: Full address registration
  - Tests all 7 fields populated
  - Tests partial address (some fields omitted)
  - Validates None for omitted fields

#### Contract Tests
- `test_register_organization_name_max_length()`: 255 char limit validation
- `test_register_address_fields_max_lengths()`: All field length limits
- `test_update_user_with_organization_and_address()`: Full address update
- `test_update_user_partial_address_fields()`: Partial updates
- `test_update_user_clear_address_fields()`: Empty string → NULL conversion
- `test_update_user_address_max_length_validation()`: Update length constraints

### Documentation
- **API Contracts** (`auth.yaml`, `users.yaml`):
  - Updated `UserRegisterRequest`, `UserCreateRequest`, `UserUpdateRequest` schemas
  - Updated `UserPublic` response schema
  - Added examples showing registration with full address
- **Quickstart Guide** (`quickstart.md`):
  - Added registration example with organization and full address
  - Added user creation example for Super Admin with address fields
  - Documented that all fields are optional
- **Data Model** (`data-model.md`): Updated users table schema
- **Tasks** (`tasks.md`): Phase 13 marked complete with all task details

## Technical Details

### Field Specifications
| Field | Type | Max Length | Nullable | Indexed |
|-------|------|------------|----------|---------|
| organization_name | VARCHAR | 255 | Yes | Yes |
| address_line1 | VARCHAR | 255 | Yes | No |
| address_line2 | VARCHAR | 255 | Yes | No |
| city | VARCHAR | 100 | Yes | No |
| state | VARCHAR | 100 | Yes | No |
| postal_code | VARCHAR | 20 | Yes | No |
| country | VARCHAR | 100 | Yes | No |

### API Examples

#### Registration with Address
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@helpinghand.org",
    "password": "SecurePass456",
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "+1-555-0199",
    "organization_name": "Helping Hand Foundation",
    "address_line1": "123 Main Street",
    "address_line2": "Suite 200",
    "city": "Boston",
    "state": "MA",
    "postal_code": "02101",
    "country": "USA"
  }'
```

#### Update User Address
```bash
curl -X PATCH http://localhost:8000/api/v1/users/{user_id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Seattle",
    "state": "WA",
    "postal_code": "98101"
  }'
```

## Testing Results
- ✅ **231 total tests passing** (224 existing + 7 new)
- ✅ **All integration tests pass** without modification (fields truly optional)
- ✅ **Contract tests validate** max length constraints
- ✅ **Empty string handling** converts to NULL in database
- ✅ **Frontend TypeScript compilation**: 0 errors
- ✅ **ESLint**: 0 errors

## Migration Safety
- ✅ **Non-breaking changes**: All new columns are nullable
- ✅ **Backward compatible**: Existing registrations work without fields
- ✅ **Index added**: `organization_name` for efficient lookups
- ✅ **Safe rollback**: Migration 009 includes proper down migration

## Related Issues
- Closes Phase 13 (T171-T187)
- Extends Feature 001 (User Authentication & Role Management)
- Supports future NPO profile management requirements

## Commits
1. `6ed41a8` - feat(spec): add optional organization name and address fields to user profile
2. `a2040b0` - refactor(spec): Move Phase 13 before Task Summary section
3. `fe9dd41` - feat(user): Add optional organization name and address fields
4. `a94f158` - feat(user): restructure address from single field to 6 structured components
5. `a793441` - feat(frontend): add organization and address fields to user management
6. `ebf89b2` - feat(tests): add comprehensive tests for organization and address fields (T180-T182)
7. `18799c6` - docs(contracts): add organization and address fields to API contracts (T185-T187)
8. `f9540be` - docs(tasks): mark Phase 13 documentation tasks complete (T185-T187)

## Checklist
- [x] Database migrations created and tested
- [x] Backend models and schemas updated
- [x] API endpoints updated with new fields
- [x] Frontend forms include new fields
- [x] TypeScript types updated
- [x] Comprehensive tests written and passing
- [x] API documentation updated
- [x] Quickstart guide updated with examples
- [x] All existing tests still pass
- [x] No breaking changes introduced

## Screenshots
### Registration Form with Address Fields
![image](https://github.com/user-attachments/assets/placeholder)

### User Management with Organization Details
![image](https://github.com/user-attachments/assets/placeholder)

## Deployment Notes
1. Run migrations: `alembic upgrade head`
2. Restart backend service
3. No frontend deployment changes needed (backward compatible)
4. Existing users will have NULL values for new fields (expected)

---

**Ready to merge**: All tests passing, documentation complete, backward compatible ✅
