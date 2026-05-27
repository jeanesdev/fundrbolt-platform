# QR Code Check-In Feature Implementation

## Summary

Successfully added QR code functionality to the check-in page, allowing event coordinators to generate and download QR codes for:
1. **Event Access** - Directs users to `app.fundrbolt.com/events/[slug]` for event access
2. **Self Check-In** - Directs users to `app.fundrbolt.com/events/[slug]/checkin` for self-service check-in

## Components Created

### 1. QRCodeDialog Component
**Location**: `/frontend/fundrbolt-admin/src/components/checkin/QRCodeDialog.tsx`

**Features**:
- Tabbed interface with two QR code types:
  - **Event Access Tab**: QR code linking to event page on app.fundrbolt.com
  - **Self Check-In Tab**: QR code linking to self check-in page
- High-quality QR code generation using `qrcode.react` library (256x256px, level H error correction)
- Download functionality for both QR codes as PNG images (1024x1024px for high quality)
- Usage tips for each QR code type
- Event name and URL display for each QR code
- Responsive design with dark mode support

**Key Functions**:
- `downloadQRCode()`: Converts SVG QR codes to high-resolution PNG images with white background
- Toast notifications for success/error states
- Clean file naming: `[event-slug]-event-access-qr.png` and `[event-slug]-checkin-qr.png`

### 2. Self Check-In Route (Donor PWA)
**Location**: `/frontend/donor-pwa/src/routes/events.$slug.checkin.tsx`

**Features**:
- Public-facing check-in page for donors
- Lookup by confirmation code or email
- Display registration details and guest list
- Check-in functionality for registrants and guests
- Event branding integration
- Navigation back to event page

## Integration Changes

### EventCheckInSection Updates
**Location**: `/frontend/fundrbolt-admin/src/features/events/sections/EventCheckInSection.tsx`

**Changes Made**:
1. Added import for `QRCodeDialog` component
2. Added `QrCode` icon from lucide-react
3. Added state: `qrCodeDialogOpen` for dialog visibility
4. Added "QR Codes" button in the header section (outline variant, positioned before Quick Sale button)
5. Rendered `QRCodeDialog` component with event slug and name props

## Dependencies Added

```bash
pnpm add qrcode.react
```

**Version**: ^4.2.0
**Purpose**: Generate high-quality QR codes in React

## URL Structure

### Event Access QR Code
```
https://app.fundrbolt.com/events/[event-slug]
```
- Opens event homepage on donor PWA
- Donors can view event details, sponsors, auction items
- Authentication required for full access

### Self Check-In QR Code
```
https://app.fundrbolt.com/events/[event-slug]/checkin
```
- Opens self-service check-in page
- Donors can look up registration by:
  - Confirmation code
  - Email address
- View registration details and guest list
- Check-in themselves and guests

## Usage Instructions

### For Event Coordinators

1. **Access QR Codes**:
   - Navigate to Event → Check-In page
   - Click "QR Codes" button in the header
   - Dialog opens with two tabs

2. **Event Access QR Code**:
   - Use for: Event marketing, invitations, entrance signage
   - Placement suggestions:
     - Event entrance displays
     - Printed invitations and programs
     - Social media posts
     - Email campaigns
   - Click "Download Event QR Code" to save as PNG

3. **Self Check-In QR Code**:
   - Use for: Check-in desk, registration table
   - Placement suggestions:
     - Check-in desk signage
     - Table tents at entrance
     - Event staff tablets/phones
   - Click "Download Check-In QR Code" to save as PNG
   - Reduces check-in time and staff workload

### For Donors

1. **Using Event Access QR Code**:
   - Scan with phone camera or QR code app
   - Redirects to event page on app.fundrbolt.com
   - Sign in or create account if prompted
   - Access event details, registration, auction, etc.

2. **Using Self Check-In QR Code**:
   - Scan at check-in desk
   - Opens check-in lookup page
   - Enter confirmation code (sent via email) OR email address
   - View registration details
   - Check in self and guests with one tap

## Technical Details

### QR Code Specifications
- **Size**: 256x256px (display), 1024x1024px (download)
- **Error Correction**: Level H (30% damage tolerance)
- **Format**: PNG with white background
- **Include Margin**: Yes (for better scanning)

### Download Process
1. Extract SVG from DOM
2. Create canvas element (1024x1024px)
3. Draw white background
4. Render QR code SVG to canvas
5. Convert canvas to PNG blob
6. Trigger browser download
7. Clean up object URLs

### Browser Compatibility
- Works in all modern browsers (Chrome, Firefox, Safari, Edge)
- Requires JavaScript enabled
- Mobile-responsive design
- Dark mode support

## Testing

### Type Checking
- ✅ Admin app: `pnpm type-check` - No errors
- ✅ Donor PWA: `pnpm type-check` - No errors

### Manual Testing Checklist
- [ ] Click "QR Codes" button on check-in page
- [ ] Verify Event Access tab displays QR code
- [ ] Verify Self Check-In tab displays QR code
- [ ] Download Event Access QR code - verify PNG quality
- [ ] Download Self Check-In QR code - verify PNG quality
- [ ] Scan Event Access QR code - verify redirects to event page
- [ ] Scan Self Check-In QR code - verify redirects to check-in page
- [ ] Test check-in flow with confirmation code
- [ ] Test check-in flow with email lookup
- [ ] Verify toast notifications appear on download

## Future Enhancements

Potential improvements for future iterations:
1. **Bulk QR Code Generation**: Generate individual check-in QR codes per attendee
2. **QR Code Customization**: Add event logo/branding to QR codes
3. **Print Templates**: Pre-formatted print layouts for signage
4. **Analytics**: Track QR code scans and check-in conversion rates
5. **Dynamic QR Codes**: Update redirect URLs without reprinting codes
6. **Email Integration**: Auto-send check-in QR codes in confirmation emails

## Files Modified/Created

### Created
1. `/frontend/fundrbolt-admin/src/components/checkin/QRCodeDialog.tsx` (270 lines)
2. `/frontend/donor-pwa/src/routes/events.$slug.checkin.tsx` (95 lines)

### Modified
1. `/frontend/fundrbolt-admin/src/features/events/sections/EventCheckInSection.tsx`
   - Added QRCodeDialog import
   - Added QrCode icon import
   - Added qrCodeDialogOpen state
   - Added QR Codes button
   - Added QRCodeDialog component rendering

### Dependencies
1. `qrcode.react@^4.2.0` added to fundrbolt-admin

## Deployment Notes

- No database migrations required
- No backend API changes needed
- Frontend-only feature
- No environment variables required
- Works with existing authentication system
- Compatible with existing check-in API endpoints
