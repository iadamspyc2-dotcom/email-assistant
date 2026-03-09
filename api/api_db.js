// api/db.js — Supabase proxy (runs on Vercel server, never exposed to browser)
const SUPABASE_URL = 'https://cafgtjvajulozcvocnurj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZmd0anZhanVsb3p2b2NudXJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwODIyMzAsImV4cCI6MjA4ODY1ODIzMH0.oQSeIgGpQx5ZoyYBau9oXQN8ieJ8VYUxwcGdNNhwRbA';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ data: null, error: 'Method not allowed' });

  const { table, operation, selectFields, filters = [], data, order, limit, single } = req.body || {};
  if (!table || !operation) return res.status(400).json({ data: null, error: 'Missing table or operation' });

  const baseHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    let url, method, headers = { ...baseHeaders }, body = null;

    if (operation === 'select') {
      const params = new URLSearchParams();
      params.set('select', selectFields || '*');
      filters.forEach(f => params.set(f.col, `${f.op}.${f.val}`));
      if (order) params.set('order', `${order.col}.${order.asc !== false ? 'asc' : 'desc'}`);
      if (limit) params.set('limit', limit);
      url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
      method = 'GET';
      if (single) headers['Accept'] = 'application/vnd.pgrst.object+json';

    } else if (operation === 'insert') {
      url = `${SUPABASE_URL}/rest/v1/${table}`;
      method = 'POST';
      body = JSON.stringify(data);
      headers['Prefer'] = 'return=representation';
      if (single) headers['Accept'] = 'application/vnd.pgrst.object+json';

    } else if (operation === 'update') {
      const params = new URLSearchParams();
      filters.forEach(f => params.set(f.col, `${f.op}.${f.val}`));
      url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
      method = 'PATCH';
      body = JSON.stringify(data);
      headers['Prefer'] = 'return=representation';
      if (single) headers['Accept'] = 'application/vnd.pgrst.object+json';

    } else if (operation === 'delete') {
      const params = new URLSearchParams();
      filters.forEach(f => params.set(f.col, `${f.op}.${f.val}`));
      url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
      method = 'DELETE';
      headers['Prefer'] = 'return=representation';

    } else if (operation === 'upsert') {
      url = `${SUPABASE_URL}/rest/v1/${table}`;
      method = 'POST';
      body = JSON.stringify(data);
      headers['Prefer'] = 'resolution=merge-duplicates,return=representation';

    } else {
      return res.status(400).json({ data: null, error: `Unknown operation: ${operation}` });
    }

    const r = await fetch(url, { method, headers, body });
    const text = await r.text();
    let result;
    try { result = JSON.parse(text); } catch (e) { result = text; }

    if (r.ok) {
      res.status(200).json({ data: result, error: null });
    } else {
      res.status(200).json({ data: null, error: result });
    }
  } catch (err) {
    res.status(500).json({ data: null, error: { message: err.message } });
  }
};
