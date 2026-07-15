/**
 * W-03 — Asset Transfer & Money Transfer
 * POST /v1/wallet/transfer
 *
 * Handles institutional asset transfers (RWA, Crypto, Traditional)
 * and money transfers between accounts.
 * Based on Transfer screen: Asset Transfer | Money Transfer
 * with APPROVED / PENDING / REJECTED workflow.
 */
const express = require('express');
const { v4: uuid } = require('uuid');
const router = express.Router();

function hashScore(str) {
  let h = 5381;
  for (const c of String(str)) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return Math.abs(h);
}

function riskAssessment(amount, assetType, recipientType) {
  const amountUSD = Number(amount) || 0;
  let score = 0;
  if (amountUSD > 500_000) score += 30;
  else if (amountUSD > 100_000) score += 15;
  if (recipientType === 'external') score += 25;
  if (assetType === 'crypto') score += 20;
  if (assetType === 'rwa') score += 5;

  const level = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { score, level };
}

function approvalStatus(risk, amount) {
  const amt = Number(amount) || 0;
  // High risk or large amount → requires approver sign-off → PENDING
  if (risk.level === 'high' || amt > 250_000) return 'pending';
  // Medium risk → auto-approved with compliance check
  if (risk.level === 'medium') return 'approved';
  return 'approved';
}

router.post('/transfer', (req, res) => {
  const {
    account_id,
    transfer_type   = 'asset',   // asset | money
    from_asset,
    recipient_type  = 'internal', // internal | external
    recipient_id,
    amount,
    currency        = 'USD',
    reference,
  } = req.body;

  if (!account_id || !amount || !recipient_id) {
    return res.status(400).json({ error: 'account_id, amount, and recipient_id are required' });
  }

  if (!['asset','money'].includes(transfer_type)) {
    return res.status(400).json({ error: 'transfer_type must be asset or money' });
  }

  const risk    = riskAssessment(amount, transfer_type === 'asset' ? (from_asset||'rwa').toLowerCase() : 'money', recipient_type);
  const status  = approvalStatus(risk, amount);
  const amt     = Number(amount);

  const transfer = {
    transfer_id:      `TRF-${uuid().slice(0,8).toUpperCase()}`,
    account_id,
    transfer_type,
    from_asset:       from_asset || (transfer_type==='money'?currency:'WALLET'),
    recipient_type,
    recipient_id,
    amount:           amt,
    currency,
    reference:        reference || null,
    status,           // approved | pending | rejected
    risk_assessment: {
      risk_level:     risk.level,
      risk_score:     risk.score,
      requires_approval: status === 'pending',
      compliance_cleared: risk.level !== 'high',
      aml_check:      'passed',
    },
    custody_model:    'MPC Custodial',
    network:          transfer_type === 'asset' ? 'Ethereum L2' : 'fiat_rail',
    estimated_settlement: transfer_type === 'asset' ? 'T+0' : 'T+1',
    ts:               new Date().toISOString(),
  };

  // Rejected if high risk AND external AND > $500K
  if (risk.level === 'high' && recipient_type === 'external' && amt > 500_000) {
    transfer.status = 'rejected';
    transfer.rejection_reason = 'Exceeds single-transaction external limit for high-risk assets. Requires manual compliance review.';
  }

  res.status(transfer.status === 'rejected' ? 422 : 200).json(transfer);
});

// GET portfolio (for testing)
router.get('/portfolio/:account_id', (req, res) => {
  const { account_id } = req.params;
  const seed = hashScore(account_id);

  res.json({
    account_id,
    total_portfolio_usd: ((seed % 9_000_000) + 500_000).toFixed(2),
    currency: 'USD',
    assets: [
      {
        id: 'USD_TREASURY_TOKEN',
        name: 'USD Treasury Token',
        type: 'rwa',
        balance_usd: 2_450_000,
        locked_usd: 300_000,
        pending_usd: 150_000,
        risk_level: 'low',
        custody: 'MPC Custodial',
        compliance_status: 'cleared',
        network: 'Ethereum L2',
        last_activity: new Date(Date.now() - 2*3600_000).toISOString(),
      },
      {
        id: 'AAPL_EQUITY_TOKEN',
        name: 'AAPL Equity Token',
        type: 'rwa',
        balance_usd: 150_000,
        locked_usd: 0,
        pending_usd: 0,
        risk_level: 'high',
        custody: 'MPC Custodial',
        compliance_status: 'restricted',
        network: 'Ethereum L2',
        last_activity: new Date(Date.now() - 24*3600_000).toISOString(),
      },
    ],
    pending_approvals: seed % 5,
    ts: new Date().toISOString(),
  });
});

module.exports = { transferRouter: router };
