// Minimal Airtable REST (v0) client: auth, pagination, and 429 rate-limit backoff.
// Airtable enforces 5 req/sec per base, so every call to the API funnels through
// `request()`, which serializes calls and backs off on 429s.

const { BASE_ID } = require('./config');

const API_ROOT = 'https://api.airtable.com/v0';
const MIN_REQUEST_GAP_MS = 220; // keeps us comfortably under 5 req/sec

let lastRequestAt = 0;
let queue = Promise.resolve();

function getToken() {
  const token = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  if (!token) {
    throw new Error('Missing AIRTABLE_TOKEN environment variable');
  }
  return token;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Serializes all Airtable calls onto one queue so we never burst past the rate limit.
function throttled(fn) {
  const run = queue.then(async () => {
    const wait = MIN_REQUEST_GAP_MS - (Date.now() - lastRequestAt);
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

async function request(path, { method = 'GET', body, query } = {}, attempt = 0) {
  const url = new URL(`${API_ROOT}/${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, value);
    }
  }

  const res = await throttled(() =>
    fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  );

  if (res.status === 429 && attempt < 5) {
    await sleep(500 * (attempt + 1));
    return request(path, { method, body, query }, attempt + 1);
  }

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message = data?.error?.message || data?.error || res.statusText;
    const err = new Error(`Airtable API error (${res.status}): ${message}`);
    err.status = res.status;
    err.details = data;
    throw err;
  }

  return data;
}

async function createRecord(tableId, fields, { typecast = false } = {}) {
  return request(`${BASE_ID}/${tableId}`, {
    method: 'POST',
    body: { records: [{ fields }], typecast },
  });
}

// Fetches every record in a table, following pagination automatically.
async function listAllRecords(tableId, { fields, sort, filterByFormula, returnFieldsByFieldId = false } = {}) {
  const records = [];
  let offset;
  do {
    const query = {
      pageSize: 100,
      offset,
      returnFieldsByFieldId: returnFieldsByFieldId ? 'true' : undefined,
      filterByFormula,
    };
    if (fields) {
      fields.forEach((f, i) => {
        query[`fields[${i}]`] = f;
      });
    }
    if (sort) {
      sort.forEach((s, i) => {
        query[`sort[${i}][field]`] = s.field;
        query[`sort[${i}][direction]`] = s.direction || 'asc';
      });
    }
    const page = await request(`${BASE_ID}/${tableId}`, { query });
    records.push(...page.records);
    offset = page.offset;
  } while (offset);
  return records;
}

module.exports = { createRecord, listAllRecords };
