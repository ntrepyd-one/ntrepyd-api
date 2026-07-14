/**
 * T-02 — Commercial Structuring
 * POST /v1/tokenization/structure
 *
 * Computes waterfall, tranches, fees, and generates
 * an indicative term sheet based on pool eligibility output.
 */
const express = require('express');
const { v4: uuid } = require('uuid');
const router  = express.Router();

// ── Rate curves (basis points, p.a.) ─────────────────────
function seniorRate(sizeMM) {
  if (sizeMM <  35) return { lo: 0.062, hi: 0.068 };
  if (sizeMM <  75) return { lo: 0.058, hi: 0.065 };
  if (sizeMM < 150) return { lo: 0.055, hi: 0.062 };
  return                      { lo: 0.052, hi: 0.059 };
}

function mezzRate(senior) {
  return { lo: senior.lo + 0.030, hi: senior.hi + 0.035 };
}

// ── Investor profile → tranche split ─────────────────────
const PROFILE_SPLIT = {
  institutional: { senior: 0.80, mezz: 0.15, equity: 0.05 },
  family_office:  { senior: 0.70, mezz: 0.20, equity: 0.10 },
  mixed:          { senior: 0.75, mezz: 0.17, equity: 0.08 },
};

// ── Fee schedule ──────────────────────────────────────────
function feeSchedule(sizeMM) {
  const structuring_pct = sizeMM < 50 ? 0.015 : sizeMM < 150 ? 0.013 : 0.012;
  return {
    structuring_pct,
    structuring_usd:    Math.round(sizeMM * 1e6 * structuring_pct),
    management_pct:     0.010,
    management_usd_pa:  Math.round(sizeMM * 1e6 * 0.010),
    performance_pct:    0.15,               // 15% of originator's funding cost savings
    performance_basis:  'savings vs prior financing rate',
    total_year1_pct:    structuring_pct + 0.010,
  };
}

// ── Savings estimate ──────────────────────────────────────
function savingsEstimate(sizeUSD, seniorRateHi) {
  const assumedBankRate = 0.095;
  const bpsLo = Math.round((assumedBankRate - (seniorRateHi + 0.010 + 0.005)) * 10000);
  const bpsHi = Math.round((assumedBankRate - (seniorRateHi - 0.010 + 0.010 + 0.005)) * 10000);
  return {
    assumed_bank_rate:   assumedBankRate,
    indicative_bps_lo:   Math.max(0, bpsLo),
    indicative_bps_hi:   Math.max(0, bpsHi),
    annual_savings_lo:   Math.round(sizeUSD * Math.max(0, bpsLo) / 10000),
    annual_savings_hi:   Math.round(sizeUSD * Math.max(0, bpsHi) / 10000),
    note:                'Net of all Ntrepyd fees. Assumes current bank financing at 9.5% p.a.',
  };
}

// ── Term sheet text ───────────────────────────────────────
function termSheetSummary(sr, sz, fees, settlement) {
  const rate = `${(sr.lo * 100).toFixed(2)}%–${(sr.hi * 100).toFixed(2)}%`;
  return [
    `Issuer: [Originator entity]`,
    `Instrument: Senior Secured Tokenized Notes — Series 2026-A`,
    `Issue size: USD ${(sz / 1e6).toFixed(0)}M (pilot tranche)`,
    `Senior coupon: ${rate} p.a. — semi-annual`,
    `Regulatory framework: EU DLT Pilot Regime, Regulation (EU) 2022/858`,
    `Custodian: Clearstream Banking S.A. (Luxembourg)`,
    `Settlement bank: City National Bank of Florida (BCI Miami)`,
    `Trustee: BNY Mellon (Luxembourg branch)`,
    `Expected settlement: ${settlement}`,
    `Structuring & Management: Ntrepyd`,
  ].join('\n');
}

// ── Handler ───────────────────────────────────────────────
router.post('/structure', (req, res) => {
  const {
    pool_id,
    target_size_usd,
    investor_profile = 'institutional',
    currency         = 'USD',
  } = req.body;

  if (!pool_id)          return res.status(400).json({ error: 'pool_id (from eligibility response) is required' });
  if (!target_size_usd)  return res.status(400).json({ error: 'target_size_usd is required' });

  const size   = Number(target_size_usd);
  const sizeMM = size / 1e6;

  if (size < 27e6) {
    return res.status(422).json({ error: 'Minimum issuance size is USD 27,000,000' });
  }

  const profile = PROFILE_SPLIT[investor_profile] || PROFILE_SPLIT.institutional;
  const sr      = seniorRate(sizeMM);
  const mr      = mezzRate(sr);
  const fees    = feeSchedule(sizeMM);

  const seniorSize = Math.round(size * profile.senior);
  const mezzSize   = Math.round(size * profile.mezz);
  const equitySize = size - seniorSize - mezzSize;

  // Expected settlement date (T+90 days from now)
  const settlement = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  const savings = savingsEstimate(size, sr.hi);

  res.json({
    structure_id:     `str_${uuid().slice(0, 8)}`,
    pool_id,
    currency,
    total_issuance:   size,
    investor_profile,

    tranches: [
      {
        name:          'Senior A',
        size_usd:      seniorSize,
        pct_of_issue:  profile.senior,
        rate_lo:       sr.lo,
        rate_hi:       sr.hi,
        rate_display:  `${(sr.lo*100).toFixed(2)}%–${(sr.hi*100).toFixed(2)}% p.a.`,
        payment:       'semi-annual',
        rating_target: 'A / A+',
        priority:      1,
      },
      {
        name:          'Mezzanine B',
        size_usd:      mezzSize,
        pct_of_issue:  profile.mezz,
        rate_lo:       mr.lo,
        rate_hi:       mr.hi,
        rate_display:  `${(mr.lo*100).toFixed(2)}%–${(mr.hi*100).toFixed(2)}% p.a.`,
        payment:       'quarterly',
        rating_target: 'BBB',
        priority:      2,
      },
      {
        name:          'Equity / First-loss',
        size_usd:      equitySize,
        pct_of_issue:  profile.equity,
        rate_display:  'Variable — residual cash flows',
        payment:       'quarterly residual',
        rating_target: 'NR',
        priority:      3,
      },
    ],

    waterfall: [
      'Ntrepyd management fee',
      'Senior A interest',
      'Senior A principal',
      'Mezzanine B interest',
      'Mezzanine B principal',
      'Equity distributions',
    ],

    reserve_account_usd: Math.round(size * 0.075),

    fees,
    indicative_savings: savings,

    counterparty_stack: {
      orchestrator:      'Ntrepyd',
      custodian:         'Clearstream Banking S.A. (Luxembourg)',
      settlement_bank:   'City National Bank of Florida (BCI Miami)',
      trustee:           'BNY Mellon Luxembourg',
      legal_luxembourg:  'Arendt & Medernach',
      legal_originator:  'Miranda & Amado (Peru) / local counsel',
      auditor:           'Deloitte Luxembourg',
      placement:         'Bci Securities Inc. / BTG Pactual',
      regulator:         'CSSF (Luxembourg) — EU DLT Pilot Regime',
    },

    expected_settlement:    settlement,
    indicative_term_sheet:  termSheetSummary(sr, size, fees, settlement),

    next_steps: [
      '1. Ntrepyd to confirm pool eligibility tape from originator',
      '2. Luxembourg SPV to be incorporated — Arendt & Medernach mandated',
      '3. Clearstream account opening for DLT Pilot Regime registration',
      '4. Investor book building — Bci Securities / BTG Pactual',
      '5. Sign and settle',
    ],

    ts: new Date().toISOString(),
  });
});

module.exports = router;
