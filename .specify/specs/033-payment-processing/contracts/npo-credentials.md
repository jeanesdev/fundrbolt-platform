# API Contracts: NPO Payment Credentials

**Router prefix**: `/api/v1/admin/npos/{npo_id}/payment-credentials`
**Auth**: Super Admin **only** for all endpoints (FR-028, FR-029, FR-030)

All request/response bodies are JSON.

---

## GET /api/v1/admin/npos/{npo_id}/payment-credentials

Retrieve the masked credential summary for an NPO. Sensitive fields are **never** returned in
plaintext (FR-029). The response indicates whether credentials exist and whether the NPO is in
sandbox or live mode.

**Auth**: Super Admin

**Path params**: `npo_id` (UUID)

**Response 200** (credentials configured):
```json
{
  "npo_id": "uuid",
  "gateway_name": "deluxe",
  "merchant_id_masked": "****5678",
  "api_key_masked": "****ab12",
  "gateway_id": "GW-001",
  "is_live_mode": false,
  "is_active": true,
  "created_at": "2026-03-10T10:00:00Z",
  "updated_at": "2026-03-10T10:00:00Z"
}
```

**Response 200** (no credentials configured):
```json
{
  "npo_id": "uuid",
  "configured": false
}
```

**Errors**:
- `403` — caller is not Super Admin
- `404` — NPO not found

---

## POST /api/v1/admin/npos/{npo_id}/payment-credentials

Create payment credentials for an NPO. The plaintext values are encrypted before storage and
never returned.

**Auth**: Super Admin

**Path params**: `npo_id` (UUID)

**Request**:
```json
{
  "gateway_name": "deluxe",
  "merchant_id": "MID-00012345",
  "api_key": "ak_live_xxxxxxxxxxxxxxxx",
  "api_secret": "as_live_xxxxxxxxxxxxxxxx",
  "gateway_id": "GW-001",
  "is_live_mode": false
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `gateway_name` | string | yes | `"deluxe"` or `"stub"` |
| `merchant_id` | string | yes | plaintext — encrypted before storage |
| `api_key` | string | yes | plaintext — encrypted before storage |
| `api_secret` | string | yes | plaintext — encrypted before storage |
| `gateway_id` | string | no | Deluxe terminal / gateway reference ID |
| `is_live_mode` | bool | no | default `false` — sandbox until explicitly set live |

**Response 201**:
```json
{
  "npo_id": "uuid",
  "gateway_name": "deluxe",
  "merchant_id_masked": "****2345",
  "is_live_mode": false,
  "is_active": true
}
```

**Errors**:
- `400` — missing required fields
- `403` — caller is not Super Admin
- `404` — NPO not found
- `409` — credentials already exist for this NPO (use PUT to update)

---

## PUT /api/v1/admin/npos/{npo_id}/payment-credentials

Replace all credentials for an NPO. Accepts the same fields as POST. All fields are required
(full replacement, not partial update).

**Auth**: Super Admin

**Request**: same schema as POST

**Response 200**:
```json
{
  "npo_id": "uuid",
  "gateway_name": "deluxe",
  "merchant_id_masked": "****9999",
  "is_live_mode": true,
  "is_active": true,
  "updated_at": "2026-03-10T14:00:00Z"
}
```

**Errors**:
- `404` — no credentials configured (use POST to create)

---

## DELETE /api/v1/admin/npos/{npo_id}/payment-credentials

Remove an NPO's payment credentials. The NPO will no longer be able to collect payments.

**Auth**: Super Admin

**Response 200**:
```json
{ "deleted": true }
```

**Errors**:
- `404` — no credentials to delete

---

## POST /api/v1/admin/npos/{npo_id}/payment-credentials/test

Validate the stored credentials by making a lightweight "ping" call to the payment gateway
(FR-030). Does not create any transaction.

**Auth**: Super Admin

**Request body**: empty `{}`

**Response 200** (credentials valid):
```json
{
  "success": true,
  "gateway_name": "deluxe",
  "is_live_mode": false,
  "message": "Sandbox credentials verified successfully"
}
```

**Response 200** (credentials invalid — returns 200 so the UI can render the error gracefully):
```json
{
  "success": false,
  "gateway_name": "deluxe",
  "is_live_mode": false,
  "message": "Authentication failed: invalid api_key",
  "error_code": "auth_failed"
}
```

*(Using HTTP 200 for both outcomes so the frontend can display the message without special
error-boundary handling. The `success` field drives UI state.)*

**Errors**:
- `404` — no credentials configured for this NPO
- `503` — gateway unreachable (network error, not credential failure)

---

## Notes on Credential Masking

The `*` masking strategy keeps the last 4 characters of each credential visible to help admins
confirm they are looking at the expected value:

```
"MID-00012345"  →  "****2345"
"ak_live_xyz"   →  "****_xyz"
```

If the credential value is 4 characters or fewer, the entire value is masked as `"****"`.

The masking is applied by `PaymentGatewayCredentialService.to_masked_response()` — never at the
model or database layer.
