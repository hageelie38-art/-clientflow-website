const { listAllRecords } = require('../lib/airtableClient');
const { CALL_LOG_TABLE_ID, CALL_LOG_FIELDS } = require('../lib/config');
const cache = require('../lib/cache');

const CACHE_KEY = 'stats';
const CACHE_TTL_MS = 60 * 1000;

async function computeStats() {
  const records = await listAllRecords(CALL_LOG_TABLE_ID, { returnFieldsByFieldId: true });

  let totalCalls = 0;
  let appointmentsBooked = 0;
  let afterHoursCalls = 0;
  let estimatedRevenue = 0;

  for (const record of records) {
    const f = record.fields;
    totalCalls += 1;

    const outcome = f[CALL_LOG_FIELDS.outcome]?.name;
    const isBooked = outcome === 'Appointment Booked';
    if (isBooked) {
      appointmentsBooked += 1;
      estimatedRevenue += Number(f[CALL_LOG_FIELDS.estJobValue]) || 0;
    }

    if (f[CALL_LOG_FIELDS.afterHours]) {
      afterHoursCalls += 1;
    }
  }

  const bookingRate = totalCalls > 0 ? (appointmentsBooked / totalCalls) * 100 : 0;

  return {
    total_calls: totalCalls,
    appointments_booked: appointmentsBooked,
    after_hours_calls: afterHoursCalls,
    estimated_revenue: Math.round(estimatedRevenue * 100) / 100,
    booking_rate: Math.round(bookingRate * 10) / 10,
    calls_would_have_missed: afterHoursCalls,
    generated_at: new Date().toISOString(),
  };
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const forceRefresh = req.query?.refresh === '1' || req.query?.refresh === 'true';
    const cached = !forceRefresh && cache.get(CACHE_KEY);
    if (cached) {
      res.status(200).json({ ...cached, cached: true });
      return;
    }

    const stats = await computeStats();
    cache.set(CACHE_KEY, stats, CACHE_TTL_MS);
    res.status(200).json({ ...stats, cached: false });
  } catch (err) {
    console.error('Failed to compute stats:', err);
    res.status(502).json({ error: 'Failed to load stats from Airtable' });
  }
}

module.exports = handler;
