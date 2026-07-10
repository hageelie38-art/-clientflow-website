const { listAllRecords } = require('../lib/airtableClient');
const { MONTHLY_SUMMARY_TABLE_ID, MONTHLY_SUMMARY_FIELDS } = require('../lib/config');

function toMonthlySummaryDTO(record) {
  const f = record.fields;
  const bookingRateRaw = Number(f[MONTHLY_SUMMARY_FIELDS.bookingRate]) || 0;
  return {
    id: record.id,
    month: f[MONTHLY_SUMMARY_FIELDS.month] || '',
    total_calls: Number(f[MONTHLY_SUMMARY_FIELDS.totalCalls]) || 0,
    after_hours_calls: Number(f[MONTHLY_SUMMARY_FIELDS.afterHoursCalls]) || 0,
    appointments_booked: Number(f[MONTHLY_SUMMARY_FIELDS.appointmentsBooked]) || 0,
    // Airtable "percent" fields store a 0-1 fraction; normalize to a 0-100 number.
    booking_rate: Math.round(bookingRateRaw * 1000) / 10, // e.g. 0.67 -> 67.0
    estimated_revenue: Number(f[MONTHLY_SUMMARY_FIELDS.estRevenue]) || 0,
    calls_would_have_missed: Number(f[MONTHLY_SUMMARY_FIELDS.callsWouldHaveMissed]) || 0,
    notes: f[MONTHLY_SUMMARY_FIELDS.notes] || '',
  };
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const records = await listAllRecords(MONTHLY_SUMMARY_TABLE_ID);
    const months = records.map(toMonthlySummaryDTO);

    res.status(200).json({ months });
  } catch (err) {
    console.error('Failed to load monthly summary:', err);
    res.status(502).json({ error: 'Failed to load monthly summary from Airtable' });
  }
}

module.exports = handler;
