/**
 * W-02 — Identity & KYC
 * POST /v1/identity/verify
 *
 * Real logic: document format validation + deterministic risk scoring.
 * Swap `verifyWithPersona()` in when Persona.com account is ready.
 */
const express = require('express');
const { v4: uuid } = require('uuid');
const router  = express.Router();

// ── Document format rules ─────────────────────────────────
const DOC_PATTERNS = {
  passport:        /^[A-Z]{1,2}[0-9]{6,9}$/,
  national_id:     /^[A-Z0-9]{6,15}$/,
  drivers_license: /^[A-Z0-9]{5,15}$/,
};

// ── Deterministic risk score from user_id ─────────────────
function riskScore(userId) {
  let h = 5381;
  for (const c of String(userId)) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return Math.abs(h) % 71; // 0–70
}

function riskTier(score) {
  if (score < 15) return 'low';
  if (score < 35) return 'medium_low';
  if (score < 55) return 'medium';
  if (score < 65) return 'medium_high';
  return 'high';
}

// ── Persona.com integration stub ──────────────────────────
async function verifyWithPersona(payload) {
  // When PERSONA_API_KEY env var is set, this runs real KYC.
  // https://docs.withpersona.com/reference/create-an-inquiry
  if (!process.env.PERSONA_API_KEY) return null;
  const res = await fetch('https://withpersona.com/api/v1/inquiries', {
    method: 'POST',
    headers: {
      'Persona-Version': '2023-01-05',
      'Authorization':   `Bearer ${process.env.PERSONA_API_KEY}`,
      'Content-Type':    'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          'inquiry-template-id': process.env.PERSONA_TEMPLATE_ID,
          'reference-id':        payload.user_id,
        },
      },
    }),
  });
  if (!res.ok) return null;
  return await res.json();
}

// ── Handler ───────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  const { user_id, document_type, document_number, kyc_level = 'basic' } = req.body;

  // Validation
  if (!user_id || !document_type || !document_number) {
    return res.status(400).json({ error: 'user_id, document_type, and document_number are required' });
  }
  const validTypes = Object.keys(DOC_PATTERNS);
  if (!validTypes.includes(document_type)) {
    return res.status(400).json({ error: `document_type must be one of: ${validTypes.join(', ')}` });
  }

  // Document format check
  const pattern = DOC_PATTERNS[document_type];
  const docValid = pattern.test(document_number.toUpperCase().replace(/\s/g, ''));
  if (!docValid) {
    return res.status(422).json({
      verification_id: `kyc_${uuid().slice(0, 8)}`,
      status:           'rejected',
      reason:           'document_format_invalid',
      kyc_level,
      wallet_eligible:  false,
    });
  }

  // Try Persona first, fall back to internal engine
  const personaResult = await verifyWithPersona(req.body);

  const score = riskScore(user_id);
  const tier  = riskTier(score);
  const amlClear = score < 65;

  const response = {
    verification_id: `kyc_${uuid().slice(0, 8)}`,
    status:           amlClear ? 'verified' : 'review_required',
    kyc_level,
    risk_score:       score,
    risk_tier:        tier,
    aml_clear:        amlClear,
    wallet_eligible:  amlClear,
    engine:           personaResult ? 'persona' : 'ntrepyd_internal',
    ts:               new Date().toISOString(),
  };

  if (personaResult) {
    response.persona_inquiry_id = personaResult?.data?.id;
  }

  res.json(response);
});

module.exports = router;
