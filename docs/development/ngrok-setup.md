# Ngrok Setup for Mobile Testing

## Quick Setup Steps

### 1. Configure Ngrok Authentication
If you haven't already, get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken

```bash
ngrok config add-authtoken YOUR_TOKEN_HERE
```

### 2. Start Your Local Services

**Terminal 1 - Backend:**
```bash
cd backend
poetry run uvicorn app.main:app --reload --host 0.0.0.0
```

**Terminal 2 - Frontend:**
```bash
cd frontend/fundrbolt-admin
pnpm dev --host
```

### 3. Start Ngrok Tunnels

**Terminal 3 - Backend Tunnel:**
```bash
./scripts/ngrok-backend.sh
```

This will output something like:
```
Forwarding: https://1234-56-78-90-12.ngrok-free.app -> http://localhost:8000
```

**Copy the HTTPS URL** (e.g., `https://1234-56-78-90-12.ngrok-free.app`)

**Terminal 4 - Frontend Tunnel:**
```bash
./scripts/ngrok-frontend.sh
```

This will output something like:
```
Forwarding: https://abcd-ef-gh-ij-kl.ngrok-free.app -> http://localhost:5173
```

**Copy the HTTPS URL** (e.g., `https://abcd-ef-gh-ij-kl.ngrok-free.app`)

### 4. Update Frontend Environment

Create or update `frontend/fundrbolt-admin/.env.local`:

```env
VITE_API_URL=https://YOUR-BACKEND-NGROK-URL/api/v1
```

For example:
```env
VITE_API_URL=https://1234-56-78-90-12.ngrok-free.app/api/v1
```

**Important**: Restart your frontend dev server after updating .env.local:
```bash
# Stop frontend (Ctrl+C in Terminal 2)
# Then restart:
cd frontend/fundrbolt-admin
pnpm dev --host
```

### 5. Access on Your Phone

1. Open your phone's browser
2. Navigate to the **frontend ngrok URL**: `https://abcd-ef-gh-ij-kl.ngrok-free.app`
3. You should see the Fundrbolt admin portal!

## Testing Session Management Features

Once set up, you can test:

### Quick Test (1 minute token expiry):
1. Temporarily modify `backend/app/core/security.py`:
   ```python
   expire = datetime.utcnow() + timedelta(minutes=1)  # Line ~85
   ```
2. Restart backend
3. Log in on your phone
4. Wait 1 minute - warning modal should appear!
5. Test "Stay Logged In" and "Log Out" buttons

### Device Tracking Test:
1. Log in from your phone
2. Check the backend logs to see your phone's User-Agent:
   ```bash
   tail -f backend/logs/app.log | grep LOGIN_SUCCESS
   ```

### Multi-Device Test:
1. Log in on your phone
2. Log in on your desktop browser
3. Log out from one device
4. Check the other device still works

## Troubleshooting

### CORS Issues
If you get CORS errors, make sure backend `app/main.py` allows ngrok origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In development, allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Ngrok Warning Page
The free tier shows a warning page before the site loads. Click "Visit Site" to continue.

### Session Storage
Phone browsers may handle localStorage differently. Test in both:
- Safari (iOS)
- Chrome (Android)

## Stopping Ngrok

Press `Ctrl+C` in each terminal running ngrok to stop the tunnels.

## Free Tier Limits

- 1 ngrok process at a time (need paid plan for simultaneous frontend + backend)
- URLs change each time you restart ngrok
- 60 connections/minute

**Workaround for free tier**:
Run only the backend ngrok, and access frontend via your local network IP:
```bash
# Find your local IP:
ip addr show | grep "inet 192"

# Access frontend on phone:
http://192.168.x.x:5173
```

Then frontend can call backend via ngrok URL.
