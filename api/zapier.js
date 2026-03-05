// api/zapier.js
// Webhook endpoint for Zapier - stores emails in Upstash Redis

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;

    // Zapier sends fields either at top level or nested under 'data'
    const d = body.data || body;

    const email = {
      id: d.id || body.id || `zapier-${Date.now()}`,
      subject: d.subject || body.subject || '(No Subject)',
      from: d.from || body.from || '',
      to: d.to || body.to || '',
      date: d.date || body.date || new Date().toISOString(),
      snippet: d.snippet || body.snippet || d.body_plain?.slice(0, 200) || '',
      body: d.body_plain || body.body_plain || d.body || body.body || '',
      labels: ['AI Review'],
      source: 'zapier',
      receivedAt: new Date().toISOString(),
    };

    // Log full body for debugging
    console.log('Zapier raw body keys:', Object.keys(body));
    console.log('Email parsed:', { subject: email.subject, from: email.from, id: email.id });

    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;

    if (!redisUrl || !redisToken) {
      return res.status(500).json({ error: 'Storage not configured' });
    }

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

    await fetch(`${redisUrl}/ltrim/emails/0/99`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${redisToken}` },
    });

    return res.status(200).json({
      success: true,
      message: 'Email received and stored',
      email_id: email.id,
      subject: email.subject,
    });

  } catch (error) {
    console.error('Zapier webhook error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
