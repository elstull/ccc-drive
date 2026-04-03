// Vercel Serverless Function — Stripe Checkout (stub)
// Will be wired to real Stripe when ready

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const { userId, planId, period } = req.body;

  if (!stripeKey) {
    // Stub mode — no Stripe configured yet
    return res.status(200).json({
      mode: 'stub',
      message: 'Stripe not yet configured. Plan selection recorded locally.',
      userId,
      planId,
      period,
    });
  }

  // TODO: Real Stripe integration
  // 1. Create or retrieve Stripe customer
  // 2. Create checkout session with price ID
  // 3. Return session URL for redirect
  //
  // const stripe = require('stripe')(stripeKey);
  // const session = await stripe.checkout.sessions.create({
  //   customer_email: req.body.email,
  //   mode: 'subscription',
  //   line_items: [{ price: priceId, quantity: 1 }],
  //   success_url: `${req.headers.origin}/?session_id={CHECKOUT_SESSION_ID}`,
  //   cancel_url: `${req.headers.origin}/pricing`,
  //   metadata: { userId, planId },
  // });
  // return res.status(200).json({ url: session.url });

  return res.status(200).json({
    mode: 'stub',
    message: 'Stripe integration pending configuration',
  });
}
