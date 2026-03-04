// api/zapier.js
// Webhook endpoint for Zapier - stores emails in Upstash Redis

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    // Build email object from Zapier payload
    const email = {
      id: body.id || `zapier-${Date.now()}`,
      subject: body.subject || '(No Subject)',
      from: body.from || '',
      to: body.to || '',
      date: body.date || new Date().toISOString(),
      snippet: body.snippet || body.body_plain?.slice(0, 200) || '',
      body: body.body_plain || body.body || '',
      labels: ['AI Review'],
      source: 'zapier',
      receivedAt: new Date().toISOString(),
    };

    // Store in Upstash Redis using the REST API
    // Vercel auto-injects KV_REST_API_URL and KV_REST_API_TOKEN
    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;

    if (!redisUrl || !redisToken) {
      console.error('Missing Redis env vars');
      return res.status(500).json({ error: 'Storage not configured' });
    }

    // Push email to a Redis list (newest first)
    const pushResponse = await fetch(`${redisUrl}/lpush/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(JSON.stringify(email)),
    });

    if (!pushResponse.ok) {
      throw new Error(`Redis push failed: ${pushResponse.status}`);
    }

    // Trim list to keep only the 100 most recent emails
    await fetch(`${redisUrl}/ltrim/emails/0/99`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
      },
    });

    console.log('📬 Email stored:', email.subject, 'from', email.from);

    return res.status(200).json({
      success: true,
      message: 'Email received and stored',
      email_id: email.id,
      subject: email.subject,
      received_at: email.receivedAt,
    });

  } catch (error) {
    console.error('Zapier webhook error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
}

