#!/bin/bash
# Test email authentication score using mail-tester.com
# This script guides you through testing your email authentication setup

set -euo pipefail

DOMAIN="fundrbolt.com"
FROM_ADDRESS="${1:-noreply@$DOMAIN}"

echo "📧 Email Authentication Score Testing"
echo "======================================"
echo ""
echo "This script will help you test your email authentication (SPF, DKIM, DMARC)"
echo "using mail-tester.com to get a deliverability score."
echo ""
echo "🎯 Target Score: 9-10 out of 10"
echo ""

# Step 1: Get test address
echo "Step 1: Get Test Email Address"
echo "------------------------------"
echo "1. Open your browser and go to: https://www.mail-tester.com"
echo "2. You will see a unique test email address like: test-abc123@srv1.mail-tester.com"
echo ""
read -p "Enter the test email address from mail-tester.com: " TEST_EMAIL

if [ -z "$TEST_EMAIL" ]; then
  echo "❌ Error: No email address provided"
  exit 1
fi

echo ""
echo "Step 2: Send Test Email"
echo "-----------------------"
echo "Sending test email to: $TEST_EMAIL"
echo "From: $FROM_ADDRESS"
echo ""

# Send test email
./infrastructure/scripts/test-email.sh "$TEST_EMAIL" "$FROM_ADDRESS"

echo ""
echo "Step 3: Check Results"
echo "--------------------"
echo "1. Go back to mail-tester.com in your browser"
echo "2. Click 'Then check your score' button"
echo "3. Wait for the analysis to complete"
echo ""
echo "📊 What to look for:"
echo "  ✅ Overall Score: 9-10 out of 10"
echo "  ✅ SPF: PASS (green checkmark)"
echo "  ✅ DKIM: PASS (green checkmark)"
echo "  ✅ DMARC: PASS (green checkmark)"
echo "  ✅ Not blacklisted"
echo "  ✅ Valid reverse DNS"
echo ""
echo "🔍 Common Issues and Solutions:"
echo ""
echo "If SPF fails:"
echo "  - Check: dig TXT $DOMAIN +short | grep spf"
echo "  - Should contain: include:spf.azurecomm.net"
echo ""
echo "If DKIM fails:"
echo "  - Check: dig CNAME selector1-azurecomm-prod-net._domainkey.$DOMAIN +short"
echo "  - Check: dig CNAME selector2-azurecomm-prod-net._domainkey.$DOMAIN +short"
echo "  - Both should return CNAME values"
echo ""
echo "If DMARC fails:"
echo "  - Check: dig TXT _dmarc.$DOMAIN +short"
echo "  - Should contain: v=DMARC1; p=quarantine"
echo ""
echo "If score is < 9:"
echo "  - Review detailed report on mail-tester.com"
echo "  - Check DNS propagation: https://dnschecker.org"
echo "  - Wait 30 minutes and re-test (DNS propagation)"
echo ""
echo "📚 For more troubleshooting, see:"
echo "   docs/operations/email-configuration.md"
