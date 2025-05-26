// Load environment variables
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Debug: Log environment variables (remove in production)
console.log('Environment check:', {
  SUPABASE_URL: process.env.SUPABASE_URL ? 'Set' : 'Not set',
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Not set',
  JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not set',
  PORT: process.env.PORT
});

// Initialize Supabase
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  console.error('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.error('SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? 'Set' : 'Not set');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

app.locals.supabase = supabase;

// Enable CORS
app.use(cors());
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

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Podium Scheduler API', status: 'running' });
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
