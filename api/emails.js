// api/emails.js
// Returns stored emails from Upstash Redis for the frontend to display

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;

    if (!redisUrl || !redisToken) {
      return res.status(500).json({ error: 'Storage not configured' });
    }

    const response = await fetch(`${redisUrl}/lrange/emails/0/49`, {
      headers: { Authorization: `Bearer ${redisToken}` },
    });

    if (!response.ok) throw new Error(`Redis fetch failed: ${response.status}`);

    const data = await response.json();
    const rawEmails = data.result || [];

    console.log('Raw emails count:', rawEmails.length);
    if (rawEmails.length > 0) {
      console.log('First raw item type:', typeof rawEmails[0]);
      console.log('First raw item preview:', JSON.stringify(rawEmails[0]).slice(0, 200));
    }

    const emails = rawEmails.map((item, i) => {
      try {
        // Item might be: a string, a double-stringified JSON, or an object
        let parsed = item;
        if (typeof parsed === 'string') parsed = JSON.parse(parsed);
        if (typeof parsed === 'string') parsed = JSON.parse(parsed); // double-encoded
        console.log(`Email ${i}: subject=${parsed.subject}, from=${parsed.from}`);
        return parsed;
      } catch(e) {
        console.log(`Failed to parse email ${i}:`, e.message);
        return null;
      }
    }).filter(Boolean);

    return res.status(200).json({ success: true, count: emails.length, emails });

  } catch (error) {
    console.error('Emails fetch error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
