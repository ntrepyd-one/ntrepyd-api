const express = require('express');
const cors    = require('cors');

const identity              = require('./routes/v1/identity');
const scoring               = require('./routes/v1/scoring');
const eligibility           = require('./routes/v1/tokenization/eligibility');
const structure             = require('./routes/v1/tokenization/structure');
const { operatorRouter }    = require('./routes/v1/wallet');
const { transferRouter }    = require('./routes/v1/transfer');
const { assetsRouter }      = require('./routes/v1/assets');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));
app.use(express.json());

// Optional API key
app.use('/v1', (req, res, next) => {
  const REQUIRED_KEY = process.env.API_KEY;
  if (!REQUIRED_KEY) return next();
  const provided = req.headers['authorization']?.replace('Bearer ', '')
                || req.headers['x-api-key'];
  if (!provided || provided !== REQUIRED_KEY) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }
  next();
});

// Routes
app.use('/v1/identity',             identity);
app.use('/v1/scoring',              scoring);
app.use('/v1/tokenization',         eligibility);
app.use('/v1/tokenization',         structure);
app.use('/v1/operators',            operatorRouter);
app.use('/v1/wallet',               transferRouter);
app.use('/v1/finance',              assetsRouter);
app.use('/v1/esim',                 assetsRouter);
app.use('/v1/insurance',            assetsRouter);

app.get('/', (req, res) => res.json({
  api:     'Ntrepyd Platform API',
  version: 'v1',
  status:  'live',
  live_endpoints: [
    'POST /v1/identity/verify',
    'POST /v1/scoring/behavioral',
    'POST /v1/tokenization/eligibility',
    'POST /v1/tokenization/structure',
    'POST /v1/operators/connect',
    'POST /v1/wallet/transfer',
    'GET  /v1/wallet/portfolio/:account_id',
    'POST /v1/finance/assess',
    'POST /v1/esim/activate',
    'POST /v1/insurance/quote',
  ],
  docs: 'https://ntrepyd.com',
}));

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

app.listen(PORT, () => console.log(`Ntrepyd API running on port ${PORT}`));
