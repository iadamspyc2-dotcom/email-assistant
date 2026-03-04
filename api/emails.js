// api/emails.js
// Returns stored emails from Upstash Redis for the frontend to display

export default async function handler(req, res) {
  // Allow CORS for frontend fetch
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redisUrl = process.env.KV_REST_API_URL;
    const redisToken = process.env.KV_REST_API_TOKEN;

    if (!redisUrl || !redisToken) {
      return res.status(500).json({ error: 'Storage not configured' });
    }

    // Fetch up to 50 most recent emails from Redis list
    const response = await fetch(`${redisUrl}/lrange/emails/0/49`, {
      headers: {
        Authorization: `Bearer ${redisToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Redis fetch failed: ${response.status}`);
    }

    const data = await response.json();
    const rawEmails = data.result || [];

    // Parse each email from JSON string
    const emails = rawEmails.map(item => {
      try {
        return typeof item === 'string' ? JSON.parse(item) : item;
      } catch {
        return null;
      }
    }).filter(Boolean);

    return res.status(200).json({
      success: true,
      count: emails.length,
      emails,
    });

  } catch (error) {
    console.error('Emails fetch error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch emails',
      details: error.message,
    });
  }
}
