require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.locals.supabase = supabase;

// Enable CORS with specific origin
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://podium-scheduler.vercel.app',
    'https://podium-scheduler-73am9gfhk-tonys-projects-dcbbf849.vercel.app',
    /https:\/\/podium-scheduler.*\.vercel\.app$/
  ],
  credentials: true
}));

app.options('*', cors());

// Raw body for Stripe webhooks
app.use('/api/payments/stripe-webhook', express.raw({type: 'application/json'}));

// JSON body for other routes
app.use(express.json());

// Routes
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/schedule', require('./src/routes/schedule'));
app.use('/api/children', require('./src/routes/children'));
app.use('/api/bookings', require('./src/routes/bookings'));
app.use('/api/payments', require('./src/routes/payments'));
app.use('/api/coach', require('./src/routes/coach'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Export for Vercel
module.exports = app;

// Start server locally
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
