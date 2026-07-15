/**
 * W-04 — Asset Management & Embedded Finance
 * POST /v1/finance/assess  — assess an asset or product
 * POST /v1/esim/activate   — eSIM activation (embedded telecom)
 * POST /v1/insurance/quote — insurance quote
 *
 * Based on:
 * - Asset detail screen: RWA, Crypto, Traditional with risk/custody/compliance
 * - eSIM screen: country, plan, activation date
 * - Insurance tab
 */
const express = require('express');
const { v4: uuid } = require('uuid');
const router = express.Router();

// ── Asset Assessment ──────────────────────────────────────
router.post('/assess', (req, res) => {
  const {
    account_id,
    asset_type    = 'rwa',  // rwa | crypto | traditional
    asset_id,
    amount,
    action        = 'buy',  // buy | sell | hold
  } = req.body;

  if (!account_id || !asset_id) {
    return res.status(400).json({ error: 'account_id and asset_id are required' });
  }

  const validTypes = ['rwa', 'crypto', 'traditional'];
  if (!validTypes.includes(asset_type)) {
    return res.status(400).json({ error: `asset_type must be one of: ${validTypes.join(', ')}` });
  }

  // Risk profiles by asset type
  const riskProfile = {
    rwa:         { level: 'low',    custody: 'MPC Custodial', network: 'Ethereum L2',  compliance: 'cleared' },
    crypto:      { level: 'medium', custody: 'MPC Custodial', network: 'Ethereum L2',  compliance: 'cleared' },
    traditional: { level: 'low',    custody: 'MPC Custodial', network: 'traditional',  compliance: 'cleared' },
  };

  const profile = riskProfile[asset_type];
  const amt = Number(amount) || 0;

  // Flag high-value RWA as restricted (like AAPL in the app)
  const flagged = asset_type === 'rwa' && amt > 100_000;

  res.json({
    assessment_id:     `FIN-${uuid().slice(0,8)}`,
    account_id,
    asset_id,
    asset_type,
    action,
    amount:            amt,
    risk_level:        flagged ? 'high' : profile.level,
    compliance_status: flagged ? 'restricted' : profile.compliance,
    custody_model:     profile.custody,
    network:           profile.network,
    requires_approval: flagged || amt > 250_000,
    eligible:          !flagged || amt <= 50_000,
    estimated_yield:   asset_type === 'rwa' ? '4.8% p.a.' : null,
    security_type:     asset_type === 'rwa' ? 'Bond / Token' : null,
    regulatory_status: asset_type === 'rwa' ? 'Registered' : 'unregistered',
    listing_venue:     asset_type === 'traditional' ? 'NYSE' : 'DLT',
    ts:                new Date().toISOString(),
  });
});

// ── eSIM Activation ───────────────────────────────────────
router.post('/esim/activate', (req, res) => {
  const {
    account_id,
    country,
    plan_type    = 'mobile_internet', // mobile_internet | calls_sms | both
    start_date   = new Date().toISOString().split('T')[0],
    auto_activate = true,
  } = req.body;

  if (!account_id || !country) {
    return res.status(400).json({ error: 'account_id and country are required' });
  }

  const prices = {
    mobile_internet: 12.99,
    calls_sms:       8.99,
    both:            19.99,
  };

  res.json({
    esim_id:        `ESIM-${uuid().slice(0,8).toUpperCase()}`,
    account_id,
    country,
    plan_type,
    price_usd:      prices[plan_type] || 12.99,
    start_date,
    auto_activate,
    status:         'provisioned',
    activation_code:`LPA:1$${uuid().slice(0,20)}`,
    qr_url:         `https://api.ntrepyd.com/v1/esim/qr/${uuid().slice(0,8)}`,
    coverage:       '190+ countries',
    ts:             new Date().toISOString(),
  });
});

// ── Insurance Quote ───────────────────────────────────────
router.post('/insurance/quote', (req, res) => {
  const {
    account_id,
    coverage_type = 'portfolio', // portfolio | device | travel | life
    insured_value,
    currency      = 'USD',
  } = req.body;

  if (!account_id) {
    return res.status(400).json({ error: 'account_id is required' });
  }

  const val = Number(insured_value) || 100_000;
  const rates = { portfolio: 0.0045, device: 0.02, travel: 0.015, life: 0.006 };
  const rate = rates[coverage_type] || 0.005;
  const annualPremium = Math.round(val * rate);

  res.json({
    quote_id:       `INS-${uuid().slice(0,8).toUpperCase()}`,
    account_id,
    coverage_type,
    insured_value:  val,
    currency,
    annual_premium: annualPremium,
    monthly_premium: Math.round(annualPremium / 12),
    coverage_start:  new Date(Date.now() + 24*3600_000).toISOString().split('T')[0],
    status:          'quoted',
    underwriter:     'Ntrepyd Insurance Partners',
    ts:              new Date().toISOString(),
  });
});

module.exports = { assetsRouter: router };
