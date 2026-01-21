#!/usr/bin/env python3
"""
Test script for T042: Send verification email to test logo display
"""
import requests
import json

API_BASE = "http://localhost:8000/api/v1"

def test_password_reset_email():
    """Send a password reset email to test logo display"""
    
    print("🔍 Testing Email Logo Display (T042)")
    print("=" * 60)
    
    # Use the super admin email from .env
    test_email = input("Enter your email address to receive test email: ").strip()
    
    if not test_email:
        print("❌ Email address required")
        return
    
    print(f"\n📧 Sending password reset email to: {test_email}")
    
    # Send password reset request
    response = requests.post(
        f"{API_BASE}/auth/password/reset/request",
        json={"email": test_email}
    )
    
    print(f"\n📊 Response Status: {response.status_code}")
    
    if response.status_code == 200:
        print("✅ Email sent successfully!")
        print("\n📋 Next Steps:")
        print("1. Check your inbox (may take 1-2 minutes)")
        print("2. Look for email from: DoNotReply@fundrbolt.com")
        print("3. Verify the following:")
        print("   ✓ Navy background header (#11294c)")
        print("   ✓ White/gold Fundrbolt logo displays")
        print("   ✓ Logo loads from: fundrboltdevstor.blob.core.windows.net")
        print("   ✓ Professional appearance in Gmail/Outlook/Apple Mail")
        print("\n4. Test in multiple email clients if possible:")
        print("   - Gmail (web + mobile)")
        print("   - Outlook (web + desktop)")
        print("   - Apple Mail (macOS + iOS)")
        print("\n5. If logo doesn't display, check:")
        print("   - Inspect email HTML source")
        print("   - Look for img src URL in header")
        print("   - Verify blob storage URL is accessible")
    elif response.status_code == 404:
        print("❌ Email not found - user doesn't exist in database")
        print("\n💡 Try registering a new account instead:")
        print("   POST /api/v1/auth/register")
        print("   This will send a verification email with the logo")
    else:
        print(f"❌ Failed to send email")
        print(f"Response: {response.text}")

if __name__ == "__main__":
    test_password_reset_email()
