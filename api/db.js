import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Check env vars exist
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      console.error('Missing env vars:', {
        URL: !!process.env.SUPABASE_URL,
        KEY: !!process.env.SUPABASE_KEY
      });
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Create supabase client for each request
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { path = '', query = '' } = req.query;
    const table = path.replace('/rest/v1/', '').split('?')[0];

    if (!table) return res.status(400).json({ error: 'No table specified' });

    if (req.method === 'GET') {
      let q = supabase.from(table).select('*');

      if (query) {
        try {
          const decoded = decodeURIComponent(query);
          for (const part of decoded.split('&')) {
            if (!part) continue;

            if (part.startsWith('order=')) {
              const orderVal = part.slice('order='.length).trim();
              if (orderVal.includes('.')) {
                const [col, dir] = orderVal.split('.');
                if (col?.trim()) {
                  q = q.order(col.trim(), { ascending: dir !== 'desc' });
                }
              }
            } else if (part.includes('=eq.')) {
              const idx = part.indexOf('=eq.');
              const col = part.slice(0, idx);
              const val = part.slice(idx + '=eq.'.length);
              if (col.trim()) q = q.eq(col.trim(), val);
            } else if (part.includes('=is.')) {
              const idx = part.indexOf('=is.');
              const col = part.slice(0, idx);
              const val = part.slice(idx + '=is.'.length);
              if (col.trim()) q = q.is(col.trim(), val === 'null' ? null : val === 'true' ? true : false);
            }
          }
        } catch (parseErr) {
          console.error('Query parse error:', parseErr.message);
        }
      }

      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const rows = Array.isArray(req.body) ? req.body : [req.body];
      const { data, error } = await supabase.from(table).insert(rows).select();
      if (error) throw error;
      return res.status(200).json(data.length === 1 ? data[0] : data);
    }

    if (req.method === 'PATCH') {
      const filters = [];
      if (query) {
        try {
          for (const part of decodeURIComponent(query).split('&')) {
            if (part.includes('=eq.')) {
              const idx = part.indexOf('=eq.');
              const col = part.slice(0, idx);
              const val = part.slice(idx + '=eq.'.length);
              if (col.trim()) filters.push([col.trim(), val]);
            }
          }
        } catch (parseErr) {
          console.error('PATCH parse error:', parseErr.message);
        }
      }

      if (!filters.length) return res.status(400).json({ error: 'No filter provided' });

      const [col, val] = filters[0];
      const { data, error } = await supabase.from(table).update(req.body).eq(col, val).select();
      if (error) throw error;
      return res.status(200).json(data && data.length > 0 ? data[0] : {});
    }

    if (req.method === 'DELETE') {
      const parts = query ? decodeURIComponent(query).split('&') : [];
      for (const part of parts) {
        if (part.includes('=eq.')) {
          const idx = part.indexOf('=eq.');
          const col = part.slice(0, idx);
          const val = part.slice(idx + '=eq.'.length);
          const { error } = await supabase.from(table).delete().eq(col, val);
          if (error) throw error;
          return res.status(200).json({ success: true });
        }
      }
      return res.status(400).json({ error: 'No delete filter provided' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('DB API Error:', error.message);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}