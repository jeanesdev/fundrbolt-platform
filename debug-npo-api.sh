#!/bin/bash

# Debug script for NPO API issues
echo "=== NPO API Debugging ==="
echo ""

echo "1. Backend Health Check:"
curl -s http://localhost:8000/health | jq -r '.status' 2>/dev/null || echo "Backend not responding"
echo ""

echo "2. Frontend Dev Server Check:"
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "Frontend is running on http://localhost:5173"
else
    echo "Frontend not responding"
fi
echo ""

echo "3. NPO Endpoint Check (without auth - should get 401):"
RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:8000/api/v1/npos)
echo "$RESPONSE" | grep -v "HTTP_CODE:"
HTTP_CODE=$(echo "$RESPONSE" | grep "HTTP_CODE:" | cut -d: -f2)
if [ "$HTTP_CODE" = "401" ]; then
    echo "✓ Endpoint exists and requires auth (correct)"
else
    echo "✗ Unexpected response code: $HTTP_CODE"
fi
echo ""

echo "4. NPO Count in Database:"
cd /home/jjeanes/augeo-platform/backend
poetry run python -c "
import asyncio
from sqlalchemy import select, text
from app.core.database import engine

async def check():
    async with engine.begin() as conn:
        result = await conn.execute(text('SELECT COUNT(*) FROM npos'))
        count = result.scalar()
        print(f'  NPOs in database: {count}')

        result = await conn.execute(text('SELECT name, status FROM npos LIMIT 5'))
        rows = result.all()
        for row in rows:
            print(f'    - {row[0]}: {row[1]}')

asyncio.run(check())
" 2>&1 || echo "  Error checking database"
echo ""

echo "5. Check for running processes:"
echo "  Backend (uvicorn):"
pgrep -f "uvicorn app.main:app" > /dev/null && echo "    ✓ Running" || echo "    ✗ Not running"
echo "  Frontend (vite):"
pgrep -f "vite" > /dev/null && echo "    ✓ Running" || echo "    ✗ Not running"
echo ""

echo "=== End of Debug ==="
echo ""
echo "If you're seeing network errors, make sure you're logged in to the frontend."
echo "Try opening the browser console (F12) to see the actual error messages."
