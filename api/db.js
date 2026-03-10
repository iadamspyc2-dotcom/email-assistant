export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = 'https://cafgtjvajulozcvocnurj.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZmd0anZhanVsb3p2b2NudXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MjIzMCwiZXhwIjoyMDg4NjU4MjMwfQ.rqB-FdyDt_G5MBW-QfWuMB-fxTHlP-b5Y1CmXJvP8cA';

  try {
    const { path = '/rest/v1/', query = '' } = req.query;
    const targetUrl = `${SUPABASE_URL}${path}${query ? '?' + query : ''}`;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(req.headers['prefer'] ? { 'Prefer': req.headers['prefer'] } : {}),
      },
      ...(req.method !== 'GET' && req.method !== 'DELETE' ? { body: JSON.stringify(req.body) } : {}),
    });

    const text = await response.text();
    // Return full debug info
    res.status(200).json({
      supabaseStatus: response.status,
      targetUrl,
      body: text,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
