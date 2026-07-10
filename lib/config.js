// Airtable base/table/field IDs for the ClientFlow AI base.
// IDs (not display names) are used everywhere so renaming a column in Airtable
// never breaks the integration.

const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appmYr2NnWtdIoKwS';

// A&E Solutions operates in the Houston, TX area (832/713/281 area codes) —
// used to derive "after hours" from the call timestamp in the business's own
// local time, not the server's. Override with BUSINESS_TIMEZONE if deployed
// for a business elsewhere.
const BUSINESS_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'America/Chicago';
const BUSINESS_HOURS_START = Number(process.env.BUSINESS_HOURS_START) || 8; // 8am
const BUSINESS_HOURS_END = Number(process.env.BUSINESS_HOURS_END) || 18; // 6pm

const CALL_LOG_TABLE_ID = process.env.AIRTABLE_CALL_LOG_TABLE_ID || 'tblvskjHbDfauOo7r';
const APPOINTMENTS_TABLE_ID = process.env.AIRTABLE_APPOINTMENTS_TABLE_ID || 'tblNIfe3DCXKllVM5';
const MONTHLY_SUMMARY_TABLE_ID = process.env.AIRTABLE_MONTHLY_SUMMARY_TABLE_ID || 'tblh2PaNByS6rqpP1';

// --- Call Log fields ---
const CALL_LOG_FIELDS = {
  callerName: 'fld95LIBubQxKUCo9', // Caller Name
  phoneNumber: 'fldh6KL721UxzKVhc', // Phone Number
  callDateTime: 'fld5zRrLkixILljfr', // Call Date/Time
  callType: 'fld2Nczt8qAQd4SVW', // Call Type (single select)
  reasonForCall: 'fldMvfuPcb40L5hxK', // Reason for Call
  outcome: 'fldTCdxPq02VX4gyG', // Outcome (single select)
  afterHours: 'fld44nRKYFzGCMZ7H', // After Hours (checkbox)
  estJobValue: 'fldalm0zUixpHysx7', // Est. Job Value (currency)
  transcript: 'fld2yTTvo38p9GlFT', // Call Transcript
};

// Ulio call_type -> Airtable "Call Type" single-select option name
const CALL_TYPE_OPTIONS = ['New Lead', 'Existing Customer', 'Emergency Service', 'Billing Question', 'Vendor/Other'];

const CALL_TYPE_SYNONYMS = {
  new_lead: 'New Lead',
  newlead: 'New Lead',
  new: 'New Lead',
  lead: 'New Lead',
  existing_customer: 'Existing Customer',
  existingcustomer: 'Existing Customer',
  existing: 'Existing Customer',
  customer: 'Existing Customer',
  emergency_service: 'Emergency Service',
  emergency: 'Emergency Service',
  emergencyservice: 'Emergency Service',
  urgent: 'Emergency Service',
  billing_question: 'Billing Question',
  billing: 'Billing Question',
  invoice: 'Billing Question',
  payment: 'Billing Question',
  vendor: 'Vendor/Other',
  vendor_other: 'Vendor/Other',
  other: 'Vendor/Other',
  spam: 'Vendor/Other',
};

// Ulio outcome -> Airtable "Outcome" single-select option name
const OUTCOME_OPTIONS = [
  'Appointment Booked',
  'Info Given',
  'Transferred to Jamie',
  'Voicemail Left',
  'Missed - Would Have Lost Call',
];

const OUTCOME_SYNONYMS = {
  booked: 'Appointment Booked',
  appointment_booked: 'Appointment Booked',
  appointmentbooked: 'Appointment Booked',
  book: 'Appointment Booked',
  info: 'Info Given',
  info_given: 'Info Given',
  information: 'Info Given',
  transfer: 'Transferred to Jamie',
  transferred: 'Transferred to Jamie',
  transfer_to_jamie: 'Transferred to Jamie',
  voicemail: 'Voicemail Left',
  voicemail_left: 'Voicemail Left',
  missed: 'Missed - Would Have Lost Call',
  missed_call: 'Missed - Would Have Lost Call',
  no_answer: 'Missed - Would Have Lost Call',
};

// --- Appointments Booked fields (referenced by name; no explicit IDs were
// specified in the project brief for this table) ---
const APPOINTMENT_FIELDS = {
  customerName: 'Customer Name',
  phoneNumber: 'Phone Number',
  serviceType: 'Service Type',
  appointmentDateTime: 'Appointment Date/Time',
  status: 'Status',
  estimatedValue: 'Estimated Value',
  bookedByAI: 'Booked By AI',
  technicianAssigned: 'Technician Assigned',
  notes: 'Notes',
};

// --- Monthly Summary fields ---
const MONTHLY_SUMMARY_FIELDS = {
  month: 'Month',
  totalCalls: 'Total Calls Handled',
  afterHoursCalls: 'After-Hours Calls Captured',
  appointmentsBooked: 'Appointments Booked',
  bookingRate: 'Booking Rate',
  estRevenue: 'Estimated Revenue Captured',
  callsWouldHaveMissed: 'Calls That Would Have Been Missed',
  notes: 'Notes',
};

module.exports = {
  BASE_ID,
  BUSINESS_TIMEZONE,
  BUSINESS_HOURS_START,
  BUSINESS_HOURS_END,
  CALL_LOG_TABLE_ID,
  APPOINTMENTS_TABLE_ID,
  MONTHLY_SUMMARY_TABLE_ID,
  CALL_LOG_FIELDS,
  CALL_TYPE_OPTIONS,
  CALL_TYPE_SYNONYMS,
  OUTCOME_OPTIONS,
  OUTCOME_SYNONYMS,
  APPOINTMENT_FIELDS,
  MONTHLY_SUMMARY_FIELDS,
};
