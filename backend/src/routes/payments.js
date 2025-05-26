const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Get available subscription plans
router.get('/plans', async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_cents');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching plans:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Create subscription checkout session
router.post('/create-subscription-checkout', authenticateToken, async (req, res) => {
  try {
    const { price_id } = req.body;
    
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can purchase subscriptions' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: req.user.email,
      line_items: [
        {
          price: price_id,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard?canceled=true`,
      metadata: {
        user_id: req.user.id,
        user_email: req.user.email
      }
    });

    res.json({ checkout_url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Stripe webhook handler
router.post('/stripe-webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Payment successful for session:', session.id);
      // TODO: Update user subscription in database
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

// Get user's subscription status
router.get('/subscription-status', authenticateToken, async (req, res) => {
  try {
    const supabase = req.app.locals.supabase;
    
    if (req.user.role !== 'parent') {
      return res.status(403).json({ error: 'Only parents can view subscription status' });
    }

    // For now, return empty subscription
    res.json({
      subscription: null,
      total_credits: 0,
      credits_detail: []
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ error: 'Failed to fetch subscription status' });
  }
});

module.exports = router;
