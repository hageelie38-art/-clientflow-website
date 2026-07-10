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

// Maps a Ulio call.ended payload to Airtable "Call Log" fields, keyed by field ID.
function mapWebhookPayload(payload) {
  const {
    caller_name,
    phone_number,
    phone,
    call_timestamp,
    timestamp,
    transcript,
    full_transcript,
    call_type,
    outcome,
    estimated_value,
    after_hours,
  } = payload;

  const fields = {
    [CALL_LOG_FIELDS.callerName]: caller_name || 'Unknown Caller',
    [CALL_LOG_FIELDS.phoneNumber]: phone_number || phone || '',
    [CALL_LOG_FIELDS.callDateTime]: toIsoTimestamp(call_timestamp || timestamp),
    [CALL_LOG_FIELDS.callType]: resolveOption(call_type, CALL_TYPE_OPTIONS, CALL_TYPE_SYNONYMS, 'Vendor/Other'),
    [CALL_LOG_FIELDS.outcome]: resolveOption(outcome, OUTCOME_OPTIONS, OUTCOME_SYNONYMS, 'Info Given'),
    [CALL_LOG_FIELDS.afterHours]: toBoolean(after_hours),
    [CALL_LOG_FIELDS.transcript]: transcript || full_transcript || '',
  };

  const estValue = toNumberOrNull(estimated_value);
  if (estValue !== null) {
    fields[CALL_LOG_FIELDS.estJobValue] = estValue;
  }

  if (payload.reason || payload.call_reason || payload.summary) {
    fields[CALL_LOG_FIELDS.reasonForCall] = payload.reason || payload.call_reason || payload.summary;
  }

  return fields;
}

module.exports = { mapWebhookPayload, resolveOption, toIsoTimestamp, toNumberOrNull, toBoolean };
