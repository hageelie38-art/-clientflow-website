require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

// Each api/*.js file exports a Vercel-style (req, res) => {} handler, so the
// same file runs standalone here (Railway/local) or as a Vercel Function.
app.post('/api/webhook', (req, res) => require('./api/webhook')(req, res));
app.get('/api/stats', (req, res) => require('./api/stats')(req, res));
app.get('/api/calls', (req, res) => require('./api/calls')(req, res));
app.get('/api/appointments', (req, res) => require('./api/appointments')(req, res));
app.get('/api/monthly-summary', (req, res) => require('./api/monthly-summary')(req, res));
app.get('/api/health', (req, res) => require('./api/health')(req, res));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ClientFlow AI backend listening on port ${PORT}`);
});
