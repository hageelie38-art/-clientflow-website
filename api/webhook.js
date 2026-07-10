const crypto = require('crypto');
const { createRecord } = require('../lib/airtableClient');
const { mapWebhookPayload } = require('../lib/mapWebhookPayload');
const { CALL_LOG_TABLE_ID } = require('../lib/config');

// If ULIO_WEBHOOK_SECRET is set, requires a matching `x-ulio-signature` header
// (the shared secret configured in Ulio's webhook settings). Skipped entirely
// when unset so the webhook still works before a secret has been configured.
function verifySignature(req) {
  const secret = process.env.ULIO_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.headers['x-ulio-signature'];
  if (!signature) return false;

  const a = Buffer.from(signature);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!verifySignature(req)) {
      console.warn('Webhook rejected: invalid signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const payload = req.body || {};

    // Only act on call.ended events; acknowledge anything else so Ulio doesn't retry.
    const eventType = payload.event || payload.event_type || payload.type;
    if (eventType && eventType !== 'call.ended') {
      res.status(200).json({ received: true, ignored: eventType });
      return;
    }

    const callData = payload.data || payload.call || payload;
    const fields = mapWebhookPayload(callData);

    await createRecord(CALL_LOG_TABLE_ID, fields, { typecast: false });

    res.status(200).json({ received: true });
  } catch (err) {
    // Never let a bad payload or a flaky Airtable call crash the process.
    // Respond non-2xx so Ulio's own retry logic gets a chance to redeliver
    // the call instead of us silently dropping it.
    console.error('Webhook processing failed:', err);
    res.status(502).json({ error: 'Failed to log call, will retry' });
  }
}

module.exports = handler;
