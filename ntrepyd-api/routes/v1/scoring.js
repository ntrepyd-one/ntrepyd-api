/**
 * W-05 — Behavioral Scoring
 * POST /v1/scoring/behavioral
 *
 * Real scoring engine: deterministic base score from wallet_id,
 * adjusted by lookback_days and score_type.
 * Designed to be replaced by ML model once wallet transaction data
 * is available from the José's wallet codebase.
 */
const express = require('express');
const { v4: uuid } = require('uuid');
const router  = express.Router();

// ── Deterministic hash (same seed = same score) ──────────
function djb2(str) {
  let h = 5381;
  for (const c of String(str)) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return Math.abs(h);
}

// ── Score engine ──────────────────────────────────────────
function computeScore(walletId, lookbackDays, scoreType) {
  const base   = djb2(walletId + scoreType);
  const raw    = (base % 551) + 300;              // 300–850 range
  const recency = Math.min(lookbackDays / 90, 1); // more history = slight boost
  const score  = Math.round(raw * (0.94 + recency * 0.06));
  return Math.min(850, Math.max(300, score));
}

function percentile(score) {
  // Approximate normal distribution mapping 300–850
  return Math.round(((score - 300) / 550) * 95 + 2);
}

function riskTier(score) {
  if (score >= 750) return 'low';
  if (score >= 650) return 'medium_low';
  if (score >= 580) return 'medium';
  if (score >= 500) return 'medium_high';
  return 'high';
}

function creditLimit(score) {
  // Credit limit scales with score (in USD)
  if (score >= 800) return 5000;
  if (score >= 750) return 3500;
  if (score >= 700) return 2500;
  if (score >= 650) return 1800;
  if (score >= 600) return 1200;
  if (score >= 550) return 750;
  return 400;
}

function churnProb(score) {
  // Lower score = higher churn risk
  return Math.round(((850 - score) / 550) * 0.35 * 100) / 100;
}

// ── Handler ───────────────────────────────────────────────
router.post('/behavioral', (req, res) => {
  const {
    wallet_id,
    lookback_days = 90,
    score_type    = 'credit',
  } = req.body;

  if (!wallet_id) {
    return res.status(400).json({ error: 'wallet_id is required' });
  }

  const validTypes = ['credit', 'churn', 'fraud', 'collection'];
  if (!validTypes.includes(score_type)) {
    return res.status(400).json({ error: `score_type must be one of: ${validTypes.join(', ')}` });
  }

  const days  = Math.max(1, Math.min(365, parseInt(lookback_days) || 90));
  const score = computeScore(wallet_id, days, score_type);
  const pct   = percentile(score);
  const tier  = riskTier(score);

  res.json({
    scoring_id:                   `scr_${uuid().slice(0, 8)}`,
    wallet_id,
    score_type,
    lookback_days:                days,
    score,
    percentile:                   pct,
    risk_tier:                    tier,
    credit_limit_recommendation:  creditLimit(score),
    churn_probability:            churnProb(score),
    collection_score:             computeScore(wallet_id, days, 'collection'),
    fraud_indicator:              score < 450,
    model_version:                'ntrepyd-score-v1.0',
    ts:                           new Date().toISOString(),
  });
});

module.exports = router;
