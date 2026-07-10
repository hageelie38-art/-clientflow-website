const { listAllRecords } = require('../lib/airtableClient');
const { CALL_LOG_TABLE_ID, CALL_LOG_FIELDS } = require('../lib/config');

function toCallDTO(record) {
  const f = record.fields;
  return {
    id: record.id,
    caller_name: f[CALL_LOG_FIELDS.callerName] || '',
    phone_number: f[CALL_LOG_FIELDS.phoneNumber] || '',
    call_date_time: f[CALL_LOG_FIELDS.callDateTime] || null,
    call_type: f[CALL_LOG_FIELDS.callType]?.name || '',
    reason_for_call: f[CALL_LOG_FIELDS.reasonForCall] || '',
    outcome: f[CALL_LOG_FIELDS.outcome]?.name || '',
    after_hours: !!f[CALL_LOG_FIELDS.afterHours],
    est_job_value: Number(f[CALL_LOG_FIELDS.estJobValue]) || 0,
    transcript: f[CALL_LOG_FIELDS.transcript] || '',
  };
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const records = await listAllRecords(CALL_LOG_TABLE_ID, { returnFieldsByFieldId: true });
    const calls = records
      .map(toCallDTO)
      .sort((a, b) => new Date(b.call_date_time || 0) - new Date(a.call_date_time || 0));

    res.status(200).json({ calls });
  } catch (err) {
    console.error('Failed to load calls:', err);
    res.status(502).json({ error: 'Failed to load calls from Airtable' });
  }
}

module.exports = handler;
