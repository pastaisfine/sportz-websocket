# Sportz — Real-Time Sports Commentary API

A backend API for live sports match tracking with real-time commentary broadcasting over WebSockets. Built as my first project exploring the WebSocket protocol, pub/sub patterns, and connection lifecycle management.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| HTTP Framework | Express 5 |
| WebSockets | `ws` (WebSocketServer on shared HTTP port) |
| Database | PostgreSQL (`pg` connection pool) |
| ORM & Migrations | Drizzle ORM + Drizzle Kit |
| Validation | Zod |
| Security | Arcjet (shield, bot detection, rate limiting) |
| Config | dotenv |

## Features

- **REST API** for matches and commentary with Zod-validated payloads
- **Real-time pub/sub over WebSockets** — clients subscribe to specific matches and receive live commentary as it's posted
- **Per-match subscription channels** using an in-memory `Map<matchId, Set<socket>>`
- **Connection heartbeat** — ping/pong every 30s to detect and terminate zombie connections (closed laptops, dropped wifi)
- **Security on both layers** — Arcjet rate limiting and bot detection on HTTP requests *and* the WebSocket upgrade handshake
- **Auto match status** — `scheduled` / `live` / `finished` derived from start/end times
- **Payload hardening** — 1 MB max WebSocket message size, capped query limits

## Architecture

```
src/
├── index.js            # Entry: Express + HTTP server + WS share one port
├── routes/
│   ├── matches.js      # GET/POST /matches
│   └── commentary.js   # GET/POST /matches/:id/commentary
├── ws/
│   └── server.js       # WebSocket server: subscriptions, broadcast, heartbeat
├── db/
│   ├── db.js           # pg Pool + Drizzle client
│   ├── schema.js       # matches & commentary tables
│   └── drizzle/        # Generated migrations
├── validation/         # Zod schemas for params, queries, bodies
└── utils/
    └── matches-status.js
arcjet.js               # HTTP + WS security rules (shared module)
```

### How the real-time flow works

1. `POST /matches` → row inserted → `broadcastMatchCreated()` pushes `{ type: 'matchCreated' }` to **all** connected clients
2. Clients send `{ type: 'subscribe', matchId: 1 }` over `/ws` to join a match channel
3. `POST /matches/:id/commentary` → row inserted → `broadcastCommentary()` pushes the entry to **only that match's subscribers**

The broadcast functions are attached in `src/ws/server.js` and exposed to routes via `app.locals`, keeping HTTP and WS layers decoupled.

## API Reference

### REST

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/matches?limit=` | List matches (newest first, max 100) |
| `POST` | `/matches` | Create a match (status auto-derived) |
| `GET` | `/matches/:id/commentary?limit=` | List commentary for a match |
| `POST` | `/matches/:id/commentary` | Add commentary (broadcasts to subscribers) |

### WebSocket — `ws://localhost:8080/ws`

**Client → Server**

```json
{ "type": "subscribe",   "matchId": 1 }
{ "type": "unsubscribe", "matchId": 1 }
```

**Server → Client**

```json
{ "type": "welcome" }
{ "type": "subscribed",   "matchId": 1 }
{ "type": "matchCreated", "data": { ... } }
{ "type": "commentary",   "data": { ... } }
```

## Getting Started

**Prerequisites:** Node.js 18+, a PostgreSQL database

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env   # then fill in values
```

Required variables in `.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/sportz
ARCJET_KEY=ajkey_...
ARCJET_MODE=LIVE        # or DRY_RUN to log decisions without blocking
PORT=8080               # optional
HOST=0.0.0.0            # optional
```

```bash
# 3. Run database migrations
npm run db:generate
npm run db:migrate

# 4. Start the server
npm run dev      # watch mode
npm start        # production
```

## Key Learnings

- Sharing a single HTTP port between Express and `ws` via `http.createServer`
- Implementing pub/sub with socket subscription bookkeeping and cleanup on `close`
- Why heartbeats matter: TCP doesn't tell you when a client vanished silently
- Securing the WS upgrade handshake, not just HTTP routes
- Validating untrusted input at every boundary with Zod

## License

ISC
