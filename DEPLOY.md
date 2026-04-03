# OrchestraIQ FSM Editor — Deployment Guide

## Target: fsm.elstull.com by noon EST, March 5, 2026

### Prerequisites
- GitHub account (you have this)
- Vercel account connected to GitHub
- Supabase account (separate project from PickleIQ)
- Domain: elstull.com (you own this — need DNS access)

---

## Step 1: Create Supabase Project (~10 min)

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: `fsm-drive`
4. Database password: (save this)
5. Region: US East (closest to you)
6. Wait for project to provision (~2 min)

### Run the migrations:

1. In Supabase Dashboard → SQL Editor
2. Paste the contents of `supabase/migrations/001_initial.sql` → Run
3. Paste the contents of `supabase/migrations/002_seed.sql` → Run
4. Verify: go to Table Editor, you should see:
   - `fsm_registry` with 6 FSM entries
   - `fsm_users` with Ed Stull and John Doe
   - `fsm_locks` (empty)
   - `fsm_events` (empty)

### Enable Realtime:

1. Go to Database → Replication
2. Enable `fsm_registry` and `fsm_locks` tables for Realtime
   (The migration tries to do this, but verify it's active)

### Get your keys:

1. Go to Settings → API
2. Copy: `Project URL` (e.g., https://xxx.supabase.co)
3. Copy: `anon public` key

---

## Step 2: Push to GitHub (~5 min)

```bash
cd fsm-drive
git init
git add .
git commit -m "OrchestraIQ FSM Editor v0.1"
git remote add origin https://github.com/YOUR_ORG/fsm-drive.git
git push -u origin main
```

---

## Step 3: Deploy to Vercel (~10 min)

1. Go to https://vercel.com/new
2. Import your GitHub repo
3. Framework: Vite
4. Add Environment Variables:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
   - `ANTHROPIC_API_KEY` = your Claude API key (for the chat feature)
5. Click Deploy

### Configure custom domain:

1. In Vercel → Project Settings → Domains
2. Add `fsm.elstull.com`
3. Vercel will give you DNS records (CNAME or A record)
4. In your DNS provider, add:
   - CNAME: `fsm` → `cname.vercel-dns.com`
5. Wait for DNS propagation (usually 5-15 min)
6. Vercel auto-provisions SSL

---

## Step 4: Test (~15 min)

### Test as Ed:
1. Open https://fsm.elstull.com
2. Click "Ed Stull" to enter
3. Verify Master FSM Interpreter loads with all 8 states
4. Double-click a state — should show inline editor with lock
5. Close (Save ✓) — changes persist
6. Navigate to Match Scheduling via the tree or drill-down
7. Test the chat: type "Hello" and verify Claude responds

### Test as John Doe (in another browser/incognito):
1. Open https://fsm.elstull.com
2. Click "John Doe"
3. Verify you see the same FSM
4. Verify Ed appears in the "Online:" presence indicator
5. Have Ed lock a state — verify John sees the 🔒 icon
6. Have Ed save — verify John's diagram updates in real-time

---

## Architecture Overview

```
Browser (Ed)  ←→  Vercel (static + /api/chat)  ←→  Claude API
Browser (John) ←→  Supabase (Postgres + Realtime + RLS)
```

- Static frontend: Vite build, served by Vercel CDN
- Chat proxy: `/api/chat` serverless function (keeps API key server-side)
- Data: Supabase Postgres with Realtime subscriptions
- Locks: `fsm_locks` table with 2-minute auto-expiry
- Events: `fsm_events` table (immutable, append-only)
- Auth: Simple user selector (no passwords for now)

---

## Files in this package

```
fsm-drive/
├── api/
│   └── chat.js              # Vercel serverless: Claude API proxy
├── public/
├── src/
│   ├── main.jsx             # Entry point
│   ├── App.jsx              # Supabase integration + user selector
│   ├── FSMEditor.jsx        # Full editor (1881 lines)
│   └── supabase.js          # Supabase client + operations
├── supabase/
│   └── migrations/
│       ├── 001_initial.sql   # Schema: tables, RLS, Realtime
│       └── 002_seed.sql      # Seed: all 6 FSM definitions
├── .env.example              # Environment variables template
├── .gitignore
├── index.html
├── package.json
├── vercel.json               # Vercel deployment config
└── DEPLOY.md                 # This file
```

---

## What works now

- Full FSM editor with all features from our week of development
- Element-level collaborative locking via Supabase
- Real-time sync: changes by one user appear for the other
- Presence: see who's online
- Chat: Claude-powered FSM design assistant (via /api/chat proxy)
- RBAC: Ed = owner, John Doe = editor
- Immutable event log for all changes

## What's deferred

- Supabase Auth (proper login with passwords) — just user selector for now
- RLS policies tied to auth (currently permissive)
- Transaction tree / hash chain (the blockchain integrity layer)
- WASM execution substrate
- Single-step debugger visualization

---

## Troubleshooting

**Blank screen after deploy**: Check browser console. Usually means env vars aren't set in Vercel.

**Chat not working**: Verify `ANTHROPIC_API_KEY` is set in Vercel env vars (NOT prefixed with VITE_).

**Realtime not updating**: In Supabase Dashboard → Database → Replication, verify `fsm_registry` and `fsm_locks` are in the publication.

**Locks not releasing**: The auto-expiry trigger fires on INSERT. If locks are stuck, manually delete from `fsm_locks` table in Supabase Dashboard.
