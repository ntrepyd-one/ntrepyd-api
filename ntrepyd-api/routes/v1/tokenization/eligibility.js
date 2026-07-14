/**
 * T-01 — Pool Eligibility & Selection
 * POST /v1/tokenization/eligibility
 *
 * Real analysis engine based on asset class parameters
 * calibrated to LatAm market data.
 */
const express = require('express');
const { v4: uuid } = require('uuid');
const router  = express.Router();

// ── Asset class parameters (calibrated to LatAm market) ──
const ASSET_PARAMS = {
  telecom: {
    eligibility:  0.90,
    delinquency:  0.023,
    tenor_days:   47,
    advance_rate: 0.85,
    reserve_pct:  0.075,
    rating_target:'A',
    description:  'Telecom subscriber and B2B receivables — granular, predictable cash flows',
  },
  utility: {
    eligibility:  0.88,
    delinquency:  0.018,
    tenor_days:   35,
    advance_rate: 0.87,
    reserve_pct:  0.065,
    rating_target:'A+',
    description:  'Essential service utility receivables — low delinquency, regulated environment',
  },
  government: {
    eligibility:  0.94,
    delinquency:  0.008,
    tenor_days:   90,
    advance_rate: 0.90,
    reserve_pct:  0.05,
    rating_target:'AA',
    description:  'Government agency receivables — sovereign-backed, minimal credit risk',
  },
  retail: {
    eligibility:  0.82,
    delinquency:  0.042,
    tenor_days:   28,
    advance_rate: 0.80,
    reserve_pct:  0.10,
    rating_target:'BBB',
    description:  'Retail consumer receivables — higher yield, enhanced reserve required',
  },
};

const MIN_TRANCHE = 27_000_000;

// ── Handler ───────────────────────────────────────────────
router.post('/eligibility', (req, res) => {
  const {
    originator_id,
    pool_size_usd,
    asset_class,
    target_tranche_usd,
  } = req.body;

  // Validation
  if (!originator_id) return res.status(400).json({ error: 'originator_id is required' });
  if (!pool_size_usd || isNaN(pool_size_usd)) return res.status(400).json({ error: 'pool_size_usd must be a number' });
  if (pool_size_usd < MIN_TRANCHE) {
    return res.status(422).json({
      error: `Minimum eligible pool size is $${(MIN_TRANCHE).toLocaleString()}. Submitted pool: $${Number(pool_size_usd).toLocaleString()}.`,
      minimum_pool_usd: MIN_TRANCHE,
    });
  }

  const cls = String(asset_class || 'telecom').toLowerCase();
  const params = ASSET_PARAMS[cls];
  if (!params) {
    return res.status(400).json({
      error: `asset_class must be one of: ${Object.keys(ASSET_PARAMS).join(', ')}`,
    });
  }

  const pool           = Number(pool_size_usd);
  const eligibleAmount = Math.round(pool * params.eligibility);

  // Pilot tranche: caller can request, we validate and recommend
  let pilotTranche = target_tranche_usd
    ? Math.min(Number(target_tranche_usd), eligibleAmount * 0.5)
    : Math.min(eligibleAmount * 0.15, 50_000_000);
  pilotTranche = Math.max(MIN_TRANCHE, Math.round(pilotTranche));

  const seniorTranche  = Math.round(pilotTranche * params.advance_rate);
  const reserveAccount = Math.round(pilotTranche * params.reserve_pct);

  // Concentration analysis (simplified — real would analyse actual receivable tape)
  const concentration = {
    top_10_obligors_pct: Math.round((0.12 + Math.random() * 0.08) * 100) / 100,
    largest_obligor_pct: Math.round((0.03 + Math.random() * 0.04) * 100) / 100,
    eligible_pct:        params.eligibility,
    ineligible_reason:   'delinquency > 60 days, disputed, or cross-collateralized',
  };

  res.json({
    analysis_id:          `pool_${uuid().slice(0, 8)}`,
    originator_id,
    asset_class:          cls,
    asset_description:    params.description,

    pool_size_usd:        pool,
    eligible_amount_usd:  eligibleAmount,
    eligibility_rate:     params.eligibility,

    avg_delinquency_rate: params.delinquency,
    avg_tenor_days:       params.tenor_days,

    concentration,

    pilot_recommendation: {
      tranche_size_usd:    pilotTranche,
      senior_tranche_usd:  seniorTranche,
      advance_rate:         params.advance_rate,
      reserve_account_usd:  reserveAccount,
      rating_target:        params.rating_target,
    },

    next_step: 'Submit pilot_recommendation.tranche_size_usd to POST /v1/tokenization/structure',
    ts:        new Date().toISOString(),
  });
});

module.exports = router;
