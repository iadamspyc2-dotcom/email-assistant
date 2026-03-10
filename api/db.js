export const config = { runtime: 'edge' };

const SUPABASE_URL = 'https://cafgtjvajulozcvocnurj.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhZmd0anZhanVsb3p2b2NudXJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzA4MjIzMCwiZXhwIjoyMDg4NjU4MjMwfQ.rqB-FdyDt_G5MBW-QfWuMB-fxTHlP-b5Y1CmXJvP8cA';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Prefer',
      }
    });
  }

  try {
    const url = new URL(req.url);
    // path after /api/db/ is the Supabase REST path e.g. /rest/v1/accounts?select=*
    const supabasePath = url.searchParams.get('path') || '/rest/v1/';
    const queryString = url.searchParams.get('query') || '';
    const targetUrl = `${SUPABASE_URL}${supabasePath}${queryString ? '?' + queryString : ''}`;

    const headers = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    };

    // Forward Prefer header if present (needed for upsert/insert returns)
    const prefer = req.headers.get('Prefer');
    if (prefer) headers['Prefer'] = prefer;

    const fetchOptions = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.method !== 'DELETE') {
      fetchOptions.body = await req.text();
    }

    const response = await fetch(targetUrl, fetchOptions);
    const text = await response.text();

    return new Response(text, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}
