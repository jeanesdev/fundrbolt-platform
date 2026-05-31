# Pre-Beta Manual Testing Checklist

> **Purpose**: Verify capabilities that cannot be covered by automated tests — real payment processing, physical device behavior, email deliverability, and third-party integrations.
>
> **When to run**: Before each public beta release, and before any release that changes payment, email, social auth, or PWA code paths.
>
> **Environment**: Run against the **staging** environment (`https://staging.fundrbolt.com`). Never run payment or social auth checks against production.

---

## Sign-Off Table

| Item | Reviewer | Date | Environment | Pass / Fail | Notes |
|------|----------|------|-------------|-------------|-------|
| 1. Real Payment — Sandbox Charge | | | Staging | | |
| 2. Real Payment — Sandbox Refund | | | Staging | | |
| 3. Email Deliverability — Gmail | | | Staging | | |
| 4. Email Deliverability — Outlook | | | Staging | | |
| 5. Email Deliverability — Yahoo | | | Staging | | |
| 6. Email Link Validity | | | Staging | | |
| 7. Apple Pay Button (macOS Safari) | | | Staging | | |
| 8. Apple Pay Button (iOS Safari) | | | Staging | | |
| 9. Google Pay Button (Chrome) | | | Staging | | |
| 10. Push Notifications — iOS Safari | | | Staging | | |
| 11. Push Notifications — Android Chrome | | | Staging | | |
| 12. Social Login — Google | | | Staging | | |
| 13. Social Login — Apple | | | Staging | | |
| 14. PWA Install — iOS Safari | | | Staging | | |
| 15. PWA Install — Android Chrome | | | Staging | | |

---

## 1. Real Payment — Sandbox Charge

**Prerequisites**: Stripe (or configured gateway) sandbox credentials deployed to staging. Use the gateway's test card numbers.

**Steps**:
1. Open the donor PWA on staging and navigate to a live event with a ticket package.
2. Add a ticket to the cart and proceed to checkout.
3. Enter the sandbox test card number (e.g., Stripe: `4242 4242 4242 4242`, exp `12/30`, CVC `123`).
4. Complete checkout.

**Expected**:
- [ ] Order confirmation page loads with order number and event details.
- [ ] Confirmation email received within 2 minutes.
- [ ] Transaction appears in the gateway's sandbox dashboard.
- [ ] `payment_transactions` record in the database has `status = 'completed'`.

---

## 2. Real Payment — Sandbox Refund

**Prerequisites**: Complete checklist item 1 first to have a transaction to refund.

**Steps**:
1. In the admin PWA, find the completed order from item 1.
2. Initiate a refund (full or partial).

**Expected**:
- [ ] Refund confirmation shown in the admin UI.
- [ ] Refund email received by the donor within 2 minutes.
- [ ] Refund appears in the gateway sandbox dashboard.
- [ ] `payment_transactions` record updated with `status = 'refunded'` or `'partially_refunded'`.

---

## 3. Email Deliverability — Gmail

**Prerequisites**: A Gmail address not previously used in tests.

**Steps**:
1. Register a new donor account using the Gmail address.
2. Check the Gmail inbox (including Spam/Promotions folders).

**Expected**:
- [ ] Verification email arrives within 2 minutes.
- [ ] Email is NOT in the Spam folder.
- [ ] Sender shows as `DoNotReply@fundrbolt.com` (or configured from address).
- [ ] All links in the email are reachable (click each one).
- [ ] HTML renders correctly (FundrBolt logo visible, no broken images).

---

## 4. Email Deliverability — Outlook / Hotmail

**Steps**: Same as item 3 using an Outlook.com address.

**Expected**:
- [ ] Arrives within 2 minutes, not in Junk folder.
- [ ] HTML renders correctly.
- [ ] All links work.

---

## 5. Email Deliverability — Yahoo Mail

**Steps**: Same as item 3 using a Yahoo Mail address.

**Expected**:
- [ ] Arrives within 2 minutes, not in Spam.
- [ ] HTML renders correctly.
- [ ] All links work.

---

## 6. Email Link Validity

**Purpose**: Verify that time-sensitive links actually work end-to-end.

**Steps**:
1. Request a password reset for an existing staging account.
2. Open the reset link from the email within 5 minutes.
3. Set a new password and sign in.

**Expected**:
- [ ] Reset link navigates to the correct password-reset page.
- [ ] New password works for sign-in.
- [ ] Using the reset link a second time returns an "invalid or expired" error.

---

## 7. Apple Pay Button — macOS Safari

**Prerequisites**: macOS device with Safari, Apple ID with a card added to Apple Wallet.

**Steps**:
1. Open the donor PWA in Safari on macOS.
2. Navigate to ticket checkout for a live event.
3. Verify the Apple Pay button is visible in the payment section.

**Expected**:
- [ ] Apple Pay button renders (not hidden, correct styling).
- [ ] Tapping "Apple Pay" opens the macOS Touch ID / Face ID sheet.
- [ ] Completing the sheet results in order confirmation.

---

## 8. Apple Pay Button — iOS Safari

**Prerequisites**: iPhone with Safari, Apple ID with a card.

**Steps**: Same as item 7 on an iPhone.

**Expected**:
- [ ] Apple Pay button renders correctly on mobile viewport.
- [ ] Tapping opens the Face ID / Touch ID bottom sheet.
- [ ] Order confirmed after authentication.

---

## 9. Google Pay Button — Chrome

**Prerequisites**: Chrome browser logged into a Google account with a card saved.

**Steps**:
1. Open the donor PWA in Chrome.
2. Navigate to ticket checkout for a live event.
3. Verify the Google Pay button is visible.

**Expected**:
- [ ] Google Pay button renders.
- [ ] Clicking opens the Google Pay sheet.
- [ ] Order confirmed after completing the sheet.

---

## 10. Push Notifications — iOS Safari

**Prerequisites**: iPhone with iOS 16.4+ using the FundrBolt donor PWA installed to Home Screen.

**Steps**:
1. Install the donor PWA (see item 14).
2. Sign in as a donor with a live event registration.
3. In the admin PWA, close bidding on an auction item the donor has bid on.

**Expected**:
- [ ] Push notification delivered to the device within 30 seconds.
- [ ] Notification title and body are correct ("Auction Closed" / "You won!" or "Outbid").
- [ ] Tapping the notification opens the donor PWA to the correct item.

---

## 11. Push Notifications — Android Chrome

**Prerequisites**: Android device with Chrome, donor PWA installed (or as a PWA via Chrome).

**Steps**: Same as item 10 on an Android device.

**Expected**:
- [ ] Push notification delivered within 30 seconds.
- [ ] Notification content correct.
- [ ] Deep link from notification works.

---

## 12. Social Login — Google

**Prerequisites**: Staging has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` configured.

**Steps**:
1. On the donor PWA sign-in page, click "Continue with Google".
2. Complete the Google OAuth flow with a personal Google account.

**Expected**:
- [ ] OAuth redirect completes successfully (no error page).
- [ ] User is signed in to the donor PWA.
- [ ] If the Google email matches an existing account, it links (not duplicate account).
- [ ] Subsequent sign-ins via Google recognize the returning user.

---

## 13. Social Login — Apple

**Prerequisites**: Staging has `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, and private key configured.

**Steps**:
1. On the donor PWA sign-in page (in Safari), click "Sign in with Apple".
2. Complete the Apple OAuth flow.

**Expected**:
- [ ] OAuth redirect completes successfully.
- [ ] User is signed in.
- [ ] If a relay email was used, subsequent sign-ins produce the same account.

---

## 14. PWA Install — iOS Safari

**Prerequisites**: iPhone with Safari.

**Steps**:
1. Open `https://staging.fundrbolt.com` in Safari (donor PWA URL).
2. Tap the Share button (□↑) → "Add to Home Screen".
3. Confirm the icon and name, tap "Add".
4. Open the app from the Home Screen.

**Expected**:
- [ ] The app opens in fullscreen (no Safari address bar).
- [ ] Splash screen / launch screen displays correctly.
- [ ] Sign-in and navigation work in standalone mode.
- [ ] Pull-to-refresh works on the main event page.

---

## 15. PWA Install — Android Chrome

**Prerequisites**: Android device with Chrome.

**Steps**:
1. Open the donor PWA URL in Chrome.
2. Chrome should show an install banner or "Add to Home screen" prompt.
3. Confirm install.
4. Open the app from the Home Screen.

**Expected**:
- [ ] App opens in standalone mode (no Chrome browser UI).
- [ ] App icon shows FundrBolt branding.
- [ ] Navigation and sign-in work.
- [ ] Offline cached content displays when network is unavailable (event home page should load from cache).

---

## Notes for Testers

- **Staging credentials**: Obtain from `ops@fundrbolt.com` or the `fundrbolt-staging-credentials` 1Password vault.
- **Gateway sandbox**: Use only test card numbers — do not enter real payment details.
- **Reset between runs**: Clear cookies / local storage between each social login test to avoid cached credentials polluting results.
- **Failure severity**: Any payment, email, or social login failure blocks release. PWA install failures are high-priority but non-blocking if the web experience works.
- **Capturing evidence**: Take screenshots or screen recordings for any Pass or Fail. Store in the release's Google Drive folder.
