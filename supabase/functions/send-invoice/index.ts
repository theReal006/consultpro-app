import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    if (!SENDGRID_API_KEY) {
      console.error('SENDGRID_API_KEY secret is not set in Supabase Edge Function secrets')
      return new Response(
        JSON.stringify({ error: 'Email service not configured. Please set SENDGRID_API_KEY in Supabase secrets.' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const { to, to_name, subject, body, from_email, from_name, invoice_number } = await req.json()

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, body' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const payload = {
      personalizations: [{
        to: [{ email: to, name: to_name || to }],
      }],
      from: {
        email: from_email || 'thealexanderny@gmail.com',
        name: from_name || 'ConsultPro',
      },
      subject,
      content: [{ type: 'text/html', value: body }],
    }

    const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!sgRes.ok) {
      const errText = await sgRes.text()
      console.error('SendGrid error:', sgRes.status, errText)
      return new Response(
        JSON.stringify({ error: `SendGrid error: ${sgRes.status}`, detail: errText }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, invoice_number }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err) {
    console.error('Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
})
