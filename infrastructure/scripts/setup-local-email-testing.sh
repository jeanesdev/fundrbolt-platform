#!/bin/bash
# Set up local email testing with MailHog (free, runs locally)
# MailHog captures emails and displays them in a web UI

set -euo pipefail

echo "📧 Setting up Local Email Testing with MailHog"
echo "=============================================="
echo ""
echo "MailHog is a local email testing tool that:"
echo "  ✓ Captures all outgoing emails (no real sending)"
echo "  ✓ Displays emails in a web UI (http://localhost:8025)"
echo "  ✓ Provides SMTP server on port 1025"
echo "  ✓ Completely free, no Azure costs"
echo ""

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "🐳 Starting MailHog container..."
docker run -d \
    --name mailhog \
    --restart unless-stopped \
    -p 1025:1025 \
    -p 8025:8025 \
    mailhog/mailhog

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ MailHog is running!"
    echo ""
    echo "📋 Configuration:"
    echo "  SMTP Server: localhost:1025"
    echo "  Web UI: http://localhost:8025"
    echo ""
    echo "🔧 Backend Configuration (.env):"
    echo "  EMAIL_PROVIDER=smtp"
    echo "  SMTP_HOST=localhost"
    echo "  SMTP_PORT=1025"
    echo "  SMTP_USERNAME="
    echo "  SMTP_PASSWORD="
    echo "  EMAIL_FROM=noreply@fundrbolt.com"
    echo ""
    echo "🧪 To test email sending:"
    echo "  1. Open http://localhost:8025 in your browser"
    echo "  2. Send test email from your app"
    echo "  3. View captured email in MailHog UI"
    echo ""
    echo "🛑 To stop MailHog:"
    echo "  docker stop mailhog"
    echo ""
else
    # If container already exists, start it
    echo "Container may already exist, trying to start existing container..."
    docker start mailhog

    if [ $? -eq 0 ]; then
        echo "✅ MailHog started!"
        echo "📧 Web UI: http://localhost:8025"
    else
        echo "❌ Failed to start MailHog"
        exit 1
    fi
fi
