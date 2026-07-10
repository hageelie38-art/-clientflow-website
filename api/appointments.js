const { listAllRecords } = require('../lib/airtableClient');
const { APPOINTMENTS_TABLE_ID, APPOINTMENT_FIELDS } = require('../lib/config');

function toAppointmentDTO(record) {
  const f = record.fields;
  return {
    id: record.id,
    customer_name: f[APPOINTMENT_FIELDS.customerName] || '',
    phone_number: f[APPOINTMENT_FIELDS.phoneNumber] || '',
    service_type: f[APPOINTMENT_FIELDS.serviceType]?.name || f[APPOINTMENT_FIELDS.serviceType] || '',
    appointment_date_time: f[APPOINTMENT_FIELDS.appointmentDateTime] || null,
    status: f[APPOINTMENT_FIELDS.status]?.name || f[APPOINTMENT_FIELDS.status] || '',
    estimated_value: Number(f[APPOINTMENT_FIELDS.estimatedValue]) || 0,
    technician_assigned: f[APPOINTMENT_FIELDS.technicianAssigned] || '',
    notes: f[APPOINTMENT_FIELDS.notes] || '',
  };
}

async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const records = await listAllRecords(APPOINTMENTS_TABLE_ID);
    const appointments = records
      .map(toAppointmentDTO)
      .sort((a, b) => new Date(a.appointment_date_time || 0) - new Date(b.appointment_date_time || 0));

    res.status(200).json({ appointments });
  } catch (err) {
    console.error('Failed to load appointments:', err);
    res.status(502).json({ error: 'Failed to load appointments from Airtable' });
  }
}

module.exports = handler;
