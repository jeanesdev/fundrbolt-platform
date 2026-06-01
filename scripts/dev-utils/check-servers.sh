#!/bin/bash
# Quick health check for Fundr Platform servers

echo "=== Fundr Platform Server Status ==="
echo ""

# Check Backend
echo "🔍 Checking Backend (port 8000)..."
if pgrep -f "uvicorn app.main:app" > /dev/null; then
    echo "✅ Backend is RUNNING (PID: $(pgrep -f 'uvicorn app.main:app'))"

    # Test health endpoint
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅ Backend health check PASSED"
    else
        echo "⚠️  Backend process running but not responding"
    fi
else
    echo "❌ Backend is NOT running"
fi

echo ""

# Check Frontend
echo "🔍 Checking Frontend (port 5173)..."
if lsof -i :5173 > /dev/null 2>&1; then
    echo "✅ Frontend is RUNNING (PID: $(lsof -ti :5173))"
else
    echo "❌ Frontend is NOT running"
fi

echo ""

# Check Database
echo "🔍 Checking Database..."
if docker ps | grep Fundr_postgres > /dev/null 2>&1; then
    echo "✅ PostgreSQL container is running"
else
    echo "❌ PostgreSQL container is NOT running"
fi

echo ""

# Check Redis
echo "🔍 Checking Redis..."
if docker ps | grep Fundr_redis > /dev/null 2>&1; then
    echo "✅ Redis container is running"
else
    echo "❌ Redis container is NOT running"
fi

echo ""
echo "=== End Status Check ==="
