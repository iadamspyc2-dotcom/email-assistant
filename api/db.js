export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  // Debug: confirm env vars are loading
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ 
      error: 'Missing env vars',
      hasUrl: !!SUPABASE_URL,
      hasKey: !!SUPABASE_KEY
    });
  }

  try {
    const { path = '/rest/v1/', query = '' } = req.query;
    const targetUrl = `${SUPABASE_URL}${path}${query ? '?' + query : ''}`;

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (req.headers['prefer']) headers['Prefer'] = req.headers['prefer'];

    const fetchOptions = { method: req.method, headers };
    if (req.method !== 'GET' && req.method !== 'DELETE') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const text = await response.text();
    
    res.status(response.status).send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
