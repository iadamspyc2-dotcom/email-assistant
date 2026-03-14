export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing env vars');
      return res.status(500).json({ error: 'Database not configured' });
    }

    const { path = '', query = '' } = req.query;
    const table = path.replace('/rest/v1/', '').split('?')[0];

    if (!table) return res.status(400).json({ error: 'No table specified' });

    const apiUrl = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
    const fetchOpts = {
      method: req.method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
    };

    if (req.method === 'POST' || req.method === 'PATCH') {
      fetchOpts.body = JSON.stringify(req.body);
    }

    console.log(`[${req.method}] ${apiUrl}`);

    const response = await fetch(apiUrl, fetchOpts);
    const data = await response.json();

    if (!response.ok) {
      console.error('Supabase error:', data);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('DB API Error:', error.message, error.stack);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}