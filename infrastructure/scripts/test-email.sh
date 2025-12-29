#!/bin/bash
# Test email sending via Azure Communication Services
# Sends a test email to verify configuration

set -euo pipefail

# Parse arguments
ENVIRONMENT="production"
RECIPIENT=""
FROM_ADDRESS_ARG=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    *)
      if [ -z "$RECIPIENT" ]; then
        RECIPIENT="$1"
      else
        FROM_ADDRESS_ARG="$1"
      fi
      shift
      ;;
  esac
done

DOMAIN="fundrbolt.com"
RESOURCE_GROUP="fundrbolt-${ENVIRONMENT}-rg"
ACS_NAME="fundrbolt-${ENVIRONMENT}-acs"
FROM_ADDRESS="${FROM_ADDRESS_ARG:-noreply@$DOMAIN}"

# Check if recipient email provided
if [ -z "$RECIPIENT" ]; then
  echo "Usage: $0 [--env dev|production] <recipient-email> [from-address]"
  echo ""
  echo "Examples:"
  echo "  $0 your-email@example.com"
  echo "  $0 --env dev your-email@example.com"
  echo "  $0 your-email@example.com support@$DOMAIN"
  echo ""
  echo "Available sender addresses:"
  echo "  - noreply@$DOMAIN (default)"
  echo "  - support@$DOMAIN"
  echo "  - billing@$DOMAIN"
  echo "  - notifications@$DOMAIN"
  exit 1
fi

# Recipient was already set in the parsing loop above
if [ -z "$RECIPIENT" ]; then
  echo "❌ Error: No recipient email provided"
  exit 1
fi

# FROM_ADDRESS_ARG was already set in the parsing loop above
if [ -n "$FROM_ADDRESS_ARG" ]; then
  FROM_ADDRESS="$FROM_ADDRESS_ARG"
fi

echo "🔍 Getting Azure Communication Services connection string..."

# Get connection string
CONNECTION_STRING=$(az communication list-key \
  --name "$ACS_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "primaryConnectionString" \
  --output tsv)

if [ -z "$CONNECTION_STRING" ]; then
  echo "❌ Error: Could not retrieve ACS connection string"
  exit 1
fi

echo "✅ Connection string retrieved"
echo ""
echo "📧 Sending test email..."
echo "  From: $FROM_ADDRESS"
echo "  To: $RECIPIENT"
echo "  Subject: Test Email from Fundrbolt Platform"
echo ""

# Send test email
MESSAGE_ID=$(az communication email send \
  --sender "$FROM_ADDRESS" \
  --subject "Test Email from Fundrbolt Platform" \
  --text "Hello!

This is a test email from the Fundrbolt Platform to verify email configuration.

If you received this email, your email setup is working correctly!

Configuration details:
- Domain: $DOMAIN
- Sender: $FROM_ADDRESS
- Sent via: Azure Communication Services

Next steps:
1. Check your spam folder if you don't see this email
2. Test email authentication score at mail-tester.com
3. Review email headers to verify SPF, DKIM, DMARC

Best regards,
The Fundrbolt Platform Team" \
  --html "<html><body>
<h2>Hello!</h2>
<p>This is a test email from the <strong>Fundrbolt Platform</strong> to verify email configuration.</p>
<p>If you received this email, your email setup is working correctly! ✅</p>
<h3>Configuration Details:</h3>
<ul>
  <li><strong>Domain:</strong> $DOMAIN</li>
  <li><strong>Sender:</strong> $FROM_ADDRESS</li>
  <li><strong>Sent via:</strong> Azure Communication Services</li>
</ul>
<h3>Next Steps:</h3>
<ol>
  <li>Check your spam folder if you don't see this email</li>
  <li>Test email authentication score at <a href='https://www.mail-tester.com'>mail-tester.com</a></li>
  <li>Review email headers to verify SPF, DKIM, DMARC</li>
</ol>
<p>Best regards,<br>The Fundrbolt Platform Team</p>
</body></html>" \
  --to "$RECIPIENT" \
  --connection-string "$CONNECTION_STRING" \
  --query "messageId" \
  --output tsv)

if [ -n "$MESSAGE_ID" ]; then
  echo "✅ Email sent successfully!"
  echo ""
  echo "📋 Message Details:"
  echo "  Message ID: $MESSAGE_ID"
  echo "  Recipient: $RECIPIENT"
  echo "  Expected delivery: < 30 seconds"
  echo ""
  echo "🔍 Verification Steps:"
  echo "  1. Check recipient inbox (and spam folder)"
  echo "  2. Verify email headers show:"
  echo "     - Received-SPF: pass"
  echo "     - DKIM-Signature: pass"
  echo "     - Authentication-Results: dmarc=pass"
  echo ""
  echo "🎯 Test Authentication Score:"
  echo "  1. Visit https://www.mail-tester.com"
  echo "  2. Get unique test email address"
  echo "  3. Run: $0 <test-address> $FROM_ADDRESS"
  echo "  4. Check score (target: 9-10/10)"
  echo ""
  echo "📊 Monitor email delivery:"
  echo "  Azure Portal → Communication Services → $ACS_NAME → Email Status"
else
  echo "❌ Failed to send email"
  exit 1
fi
