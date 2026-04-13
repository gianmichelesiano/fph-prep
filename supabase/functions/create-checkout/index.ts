import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' })

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id, email } = await req.json()
    if (!user_id) return new Response(JSON.stringify({ error: 'Missing user_id' }), { status: 400, headers: corsHeaders })

    const origin = req.headers.get('origin') || 'http://localhost:5173'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: 'chf',
            unit_amount: 8900, // 89.00 CHF in centesimi
            product_data: {
              name: 'FPH Prep – Accesso Completo',
              description: 'Accesso permanente a tutte le simulazioni FPH Offizin',
            },
          },
          quantity: 1,
        },
      ],
      metadata: { user_id },
      success_url: `${origin}/payment-success`,
      cancel_url: `${origin}/upgrade`,
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
