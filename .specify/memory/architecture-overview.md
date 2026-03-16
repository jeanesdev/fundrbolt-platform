# FundrBolt Architecture Overview

## System Components

```

┌─────────────────────────────────────────────────────────────┐
│                        Internet/CDN                          │
│                    (Azure CDN, Front Door)                   │
└───────────────────┬─────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
    ▼               ▼               ▼
┌─────────┐   ┌─────────┐   ┌──────────────┐
│  PWA    │   │  Admin  │   │ Auctioneer   │
│ (Donor) │   │   UI    │   │  Dashboard   │
└────┬────┘   └────┬────┘   └──────┬───────┘
     │             │                │
     │      HTTPS + WebSocket       │
     │             │                │
     └─────────────┼────────────────┘
                   │
            ┌──────▼──────┐
            │   FastAPI   │
            │   Backend   │
            │ (API + WS)  │
            └──────┬──────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
     ▼             ▼             ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│PostgreSQL│ │  Redis  │  │  Blob   │
│ (Azure) │  │ (Azure) │  │ Storage │
└─────────┘  └─────────┘  └─────────┘
    │             │             │
    └─────────────┼─────────────┘
                  │
           ┌──────▼──────┐
           │  External   │
           │  Services   │
           │  (Stripe,   │
           │   Twilio)   │
           └─────────────┘

```

## Request Flow Examples

### Bid Placement Flow
1. Donor clicks "Place Bid" button in PWA
2. PWA sends HTTP POST to `/api/v1/bids` with JWT token
3. FastAPI validates token, checks bid rules
4. FastAPI writes bid to PostgreSQL
5. FastAPI publishes bid event to Redis pub/sub
6. WebSocket server pushes update to all clients in event room
7. All tablets show updated leaderboard (<500ms total)

### Real-Time Architecture
- **Protocol:** Socket.IO (WebSocket with fallback)
- **Rooms:** One room per event (`event:{event_id}`)
- **Events:**
  - `bid_placed` - New bid on item
  - `item_sold` - Auction closed for item
  - `leaderboard_update` - Top bidders changed
  - `paddle_locked` - Auctioneer locked a paddle
- **Clients:** PWA (donor), Auctioneer dashboard, Admin dashboard
- **Server:** FastAPI with python-socketio

## Data Flow

### Write Path (Bidding)
HTTP POST → FastAPI → PostgreSQL → Redis pub/sub → WebSocket broadcast

### Read Path (Browsing Items)
HTTP GET → FastAPI → Redis cache (if cached) → PostgreSQL (if miss) → Cache + Return

## Deployment

### Local Dev
- Docker Compose with 5 services: FastAPI, PostgreSQL, Redis, React (Vite), Nginx
- Poetry manages Python deps
- npm manages frontend deps

### Staging/Production
- Azure Container Apps (FastAPI backend)
- Azure Database for PostgreSQL
- Azure Cache for Redis
- Azure Blob Storage
- Azure CDN (React PWA static files)
- GitHub Actions CI/CD
