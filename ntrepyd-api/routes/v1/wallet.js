/**
 * W-01 — Operator Account Registration
 * POST /v1/operators/connect
 *
 * Onboards an institutional operator (telecom, utility, government)
 * as a custody account on the Ntrepyd platform.
 * Based on the NOVA TELECOM LTD account model in the wallet app.
 */
const express = require('express');
const { v4: uuid } = require('uuid');
const router = express.Router();

function hashId(str) {
  let h = 5381;
  for (const c of String(str)) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return Math.abs(h).toString(16).slice(0,6).toUpperCase();
}

// W-01: Operator Connect
router.post('/connect', (req, res) => {
  const { operator_id, operator_name, operator_type, subscriber_base, contact_email } = req.body;

  if (!operator_id || !operator_type) {
    return res.status(400).json({ error: 'operator_id and operator_type are required' });
  }

  const validTypes = ['telecom', 'utility', 'government', 'financial'];
  if (!validTypes.includes(operator_type)) {
    return res.status(400).json({ error: `operator_type must be one of: ${validTypes.join(', ')}` });
  }

  const accountId = `ACC-${hashId(operator_id)}`;
  const subscribers = Number(subscriber_base) || 0;

  // Custody tier based on subscriber base
  const custodyTier = subscribers > 5_000_000 ? 'MPC Custodial — Tier 1'
    : subscribers > 1_000_000 ? 'MPC Custodial — Tier 2'
    : 'MPC Custodial — Standard';

  res.json({
    connection_id:    `conn_${uuid().slice(0,8)}`,
    account_id:       accountId,
    operator_name:    operator_name || operator_id,
    operator_type,
    status:           'active',
    custody_model:    custodyTier,
    network:          'Ethereum L2',
    governance:       'enabled',
    pending_approvals: 0,
    risk_level:       'low',
    subscriber_count: subscribers,
    data_streams:     ['billing', 'usage', 'demographics'],
    wallet_activation_url: `https://platform.ntrepyd.com/activate/${accountId}`,
    portal_url:       `https://ntrepyd.com`,
    ts:               new Date().toISOString(),
  });
});

module.exports = { operatorRouter: router };
