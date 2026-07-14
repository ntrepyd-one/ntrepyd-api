const express = require('express');
const cors    = require('cors');

const identity    = require('./routes/v1/identity');
const scoring     = require('./routes/v1/scoring');
const eligibility = require('./routes/v1/tokenization/eligibility');
const structure   = require('./routes/v1/tokenization/structure');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────
app.use(cors({
  origin: ['https://*.netlify.app', 'https://*.ntrepyd.com', 'http://localhost:5500', 'null', '*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));
app.use(express.json());

// ── Optional API key check (skip if no key configured) ───
app.use('/v1', (req, res, next) => {
  const REQUIRED_KEY = process.env.API_KEY;
  if (!REQUIRED_KEY) return next(); // no key configured → open
  const provided = req.headers['authorization']?.replace('Bearer ', '')
                || req.headers['x-api-key'];
  if (!provided || provided !== REQUIRED_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
});

// ── Routes ────────────────────────────────────────────────
app.use('/v1/identity',       identity);
app.use('/v1/scoring',        scoring);
app.use('/v1/tokenization',   eligibility);
app.use('/v1/tokenization',   structure);

// ── Health + meta ─────────────────────────────────────────
app.get('/', (req, res) => res.json({
  api:     'Ntrepyd Platform API',
  version: 'v1',
  status:  'live',
  endpoints: [
    'POST /v1/identity/verify',
    'POST /v1/scoring/behavioral',
    'POST /v1/tokenization/eligibility',
    'POST /v1/tokenization/structure',
  ],
  docs: 'https://platform.ntrepyd.com/developers',
}));

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Endpoint not found: ${req.method} ${req.path}` }));

app.listen(PORT, () => console.log(`Ntrepyd API running on port ${PORT}`));
