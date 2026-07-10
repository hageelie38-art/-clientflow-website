const {
    CALL_LOG_FIELDS,
    CALL_TYPE_OPTIONS,
    CALL_TYPE_SYNONYMS,
    OUTCOME_OPTIONS,
    OUTCOME_SYNONYMS,
} = require('./config');

function normalizeKey(value) {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
}

// Matches a raw Ulio value against the exact Airtable option list first, then
// known synonyms, then falls back to a substring match before giving up.
function resolveOption(rawValue, options, synonyms, fallback) {
    if (!rawValue) return fallback;
    const key = normalizeKey(rawValue);

  const exact = options.find((opt) => normalizeKey(opt) === key);
    if (exact) return exact;

  if (synonyms[key]) return synonyms[key];

  const partial = options.find((opt) => normalizeKey(opt).includes(key) || key.includes(normalizeKey(opt)));
    if (partial) return partial;

  return fallback;
}

function toIsoTimestamp(value) {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function toNumberOrNull(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    const key = normalizeKey(value);
    return key === 'true' || key === '1' || key === 'yes';
}

// Real Ulio call.ended payloads look like:
//   { event: 'call.ended', timestamp, data: { caller_number, caller_name,
//     duration_seconds, summary, sentiment, intent, appointment_booked,
//     callback_required, ended_reason, calculated_value, call_id, shop_id,
//     test_mode } }
// Ulio's own intent values -> our Airtable "Call Type" single-select options.
const INTENT_TO_CALL_TYPE = {
    appointment: 'New Lead',
    emergency: 'Emergency Service',
    existing_customer: 'Existing Customer',
    billing: 'Billing Question',
};

// Maps a Ulio call.ended webhook envelope to Airtable "Call Log" fields, keyed by field ID.
function mapWebhookPayload(payload) {
    const data = payload.data || payload;

  // The real call time is at the TOP level of the envelope, not inside `data`.
  const callTimestamp = payload.timestamp || data.call_timestamp || data.timestamp || new Date().toISOString();

  // Ulio doesn't send an explicit "after hours" flag, so derive it from the
  // call timestamp against A&E's business hours (8am-6pm).
  const hour = new Date(callTimestamp).getHours();
    const derivedAfterHours = hour < 8 || hour >= 18;

  // Ulio sends appointment_booked (bool) + ended_reason, not a single "outcome" string.
  let outcome;
    if (data.appointment_booked) {
          outcome = 'Appointment Booked';
    } else if (data.ended_reason === 'transferred') {
          outcome = 'Transferred to Jamie';
    } else if (data.ended_reason === 'voicemail') {
          outcome = 'Voicemail Left';
    } else {
          outcome = resolveOption(data.outcome, OUTCOME_OPTIONS, OUTCOME_SYNONYMS, 'Info Given');
    }

  // Ulio sends `intent` (e.g. "appointment"), not `call_type` — map their
  // intent values to our Airtable single-select options, with the generic
  // resolver as a fallback for any value we haven't seen yet.
  const callType = INTENT_TO_CALL_TYPE[data.intent]
      || resolveOption(data.call_type || data.intent, CALL_TYPE_OPTIONS, CALL_TYPE_SYNONYMS, 'Vendor/Other');

  const fields = {
        [CALL_LOG_FIELDS.callerName]: data.caller_name || 'Unknown Caller',
        [CALL_LOG_FIELDS.phoneNumber]: data.caller_number || data.phone_number || data.phone || '',
        [CALL_LOG_FIELDS.callDateTime]: toIsoTimestamp(callTimestamp),
        [CALL_LOG_FIELDS.callType]: callType,
        [CALL_LOG_FIELDS.outcome]: outcome,
        [CALL_LOG_FIELDS.afterHours]: toBoolean(data.after_hours ?? derivedAfterHours),
        // Ulio only sends a `summary`, not a full transcript — use it as the closest available text.
        [CALL_LOG_FIELDS.transcript]: data.transcript || data.full_transcript || data.summary || '',
  };

  const estValue = toNumberOrNull(data.calculated_value ?? data.estimated_value);
    if (estValue !== null) {
          fields[CALL_LOG_FIELDS.estJobValue] = estValue;
    }

  if (data.reason || data.call_reason || data.summary) {
        fields[CALL_LOG_FIELDS.reasonForCall] = data.reason || data.call_reason || data.summary;
  }

  return fields;
}

module.exports = { mapWebhookPayload, resolveOption, toIsoTimestamp, toNumberOrNull, toBoolean };
