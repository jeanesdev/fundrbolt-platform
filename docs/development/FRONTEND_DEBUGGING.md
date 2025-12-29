# Debugging Frontend in VS Code

## ✅ Setup Complete!

The landing-site is now running on **http://localhost:3001**

## Quick Start - No Debugging Needed

Just use the browser:
1. ✅ Landing-site is running at: http://localhost:3001/testimonials
2. Open in any browser and test the UI
3. Use browser DevTools (F12) to debug

## VS Code Debugging (Optional)

If you want to debug TypeScript/React code with breakpoints in VS Code:

### Step 1: Ensure Server is Running
```bash
# Check if running:
curl http://localhost:3001

# Or start manually:
cd frontend/landing-site
source ~/.nvm/nvm.sh && nvm use 22
pnpm dev
```

### Step 2: Launch Debugger
1. Press `F5` or go to **Run and Debug** (Ctrl+Shift+D)
2. Select one of these configurations:
   - **"Frontend: Landing Site (Chrome)"** - Opens homepage
   - **"Frontend: Landing Site - Testimonials (Chrome)"** - Opens testimonials page directly
3. Click the green play button

This will:
- Open Chrome with debugging enabled
- Connect VS Code debugger to the browser
- Allow you to set breakpoints in `.tsx` files
- Step through React component code

### Setting Breakpoints
1. Open any TypeScript file (e.g., `TestimonialsPage.tsx`)
2. Click in the left margin to add a red dot (breakpoint)
3. Trigger the code path in the browser
4. VS Code will pause execution at your breakpoint

## Current Services Status

✅ **Backend**: http://localhost:8000 (FastAPI)
✅ **Landing Site**: http://localhost:3001 (Public website)
✅ **PostgreSQL**: localhost:5432
✅ **Redis**: localhost:6379

## Testing Without Debugger

Most testing can be done without VS Code debugging:

**Browser Testing** (Recommended):
- Open http://localhost:3001/testimonials
- Use browser DevTools (F12) for:
  - Console logs
  - Network requests
  - Element inspection
  - Responsive design testing

**API Testing**:
```bash
# Test backend directly
curl http://localhost:8000/api/v1/public/testimonials | python3 -m json.tool
```

## Troubleshooting

**"Port already in use"**:
```bash
# Kill all frontend servers
pkill -f vite

# Or kill specific port
lsof -ti:3001 | xargs kill -9
```

**"Page won't load"**:
```bash
# Check if server is running
pgrep -af vite

# Restart landing-site
cd frontend/landing-site
pnpm dev
```

**"Wrong app is running"**:
- fundrbolt-admin runs on port **5173**
- landing-site runs on port **3001**
- Make sure you're accessing the right port!

## Manual Testing Guide

For complete testing instructions, see:
📋 **docs/development/T057_MANUAL_TESTING.md**

## Summary

**You don't need a separate launch.json to debug the frontend** - I've already added the configurations:
- ✅ `launch.json` updated with landing-site debugging
- ✅ `tasks.json` updated with `start-landing-site` task
- ✅ Press F5 and select "Frontend: Landing Site - Testimonials (Chrome)"

But honestly, **just use the browser** at http://localhost:3001/testimonials - it's faster for manual testing! 🚀
