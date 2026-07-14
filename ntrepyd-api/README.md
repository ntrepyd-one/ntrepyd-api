# Ntrepyd Platform API

Backend for the Ntrepyd Platform portal. Four live endpoints.

## Live endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/identity/verify` | W-02 — KYC & identity verification |
| POST | `/v1/scoring/behavioral` | W-05 — AI behavioral scoring |
| POST | `/v1/tokenization/eligibility` | T-01 — Pool eligibility analysis |
| POST | `/v1/tokenization/structure` | T-02 — Commercial structuring & term sheet |
| GET | `/health` | Health check |
| GET | `/` | API meta |

---

## Deploy to Railway (10 minutes)

### Option A — Railway CLI (recommended)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. From the ntrepyd-api folder:
cd ntrepyd-api
railway init        # creates a new project
railway up          # deploys

# 4. Get your URL
railway domain      # e.g. ntrepyd-api.up.railway.app
```

### Option B — GitHub + Railway dashboard

1. Push this folder to a GitHub repo
2. Go to railway.app → New Project → Deploy from GitHub
3. Select the repo → Railway auto-detects Node.js and deploys
4. Get the public URL from the Railway dashboard

---

## Environment variables (all optional)

Set these in the Railway dashboard under Variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Auto-set by Railway |
| `API_KEY` | none | If set, requires `Authorization: Bearer <key>` on all requests |
| `PERSONA_API_KEY` | none | Persona.com key for real KYC (W-02 falls back to internal engine if not set) |
| `PERSONA_TEMPLATE_ID` | none | Persona inquiry template ID |

---

## Connect to the portal

Once deployed, update `API_BASE` at the top of `ntrepyd_portal.html`:

```javascript
const API_BASE = 'https://ntrepyd-api.up.railway.app';
// Leave empty to use sandbox mode:
// const API_BASE = '';
```

---

## Test locally

```bash
npm install
npm run dev   # starts with nodemon on port 3000

# Test eligibility
curl -X POST http://localhost:3000/v1/tokenization/eligibility \
  -H "Content-Type: application/json" \
  -d '{"originator_id":"integra-001","pool_size_usd":260000000,"asset_class":"telecom"}'
```

---

## Roadmap — next endpoints

| Endpoint | Requires | ETA |
|----------|----------|-----|
| POST `/v1/operators/connect` (W-01) | Wallet BSS/OSS code from José | Week 2 |
| POST `/v1/wallet/transaction` (W-03) | Payment rail integration | Week 2 |
| POST `/v1/finance/assess` (W-04) | Credit partner API | Week 3 |
| POST `/v1/tokenization/issue` (T-03) | Clearstream DLT access | Week 6 |
| POST `/v1/settlement/execute` (T-04) | CNB Miami banking integration | Week 6 |
| POST `/v1/distribution/report` (T-05) | CSSF regulatory setup | Week 8 |
