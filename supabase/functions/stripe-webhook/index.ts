import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-04-10' })
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id

    if (!userId) {
      console.error('No user_id in session metadata')
      return new Response(JSON.stringify({ error: 'No user_id' }), { status: 400 })
    }

    // Mark user as premium
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_premium: true,
        premium_since: new Date().toISOString(),
        stripe_customer_id: session.customer as string,
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating profile:', profileError)
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500 })
    }

    // Log payment
    await supabase.from('payments').insert({
      user_id: userId,
      stripe_session_id: session.id,
      amount: session.amount_total,
      currency: session.currency,
      status: 'completed',
    })

    console.log(`User ${userId} upgraded to premium`)
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
