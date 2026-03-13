import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.query.test === 'ping') {
      try {
        const r = await fetch('https://cafgtjvajulozcvocnurj.supabase.co/rest/v1/');
        return res.status(200).json({ ok: true, status: r.status });
      } catch(e) {
        return res.status(200).json({ ok: false, error: e.message });
      }
    }

    const { path = '', query = '' } = req.query;
    const table = path.replace('/rest/v1/', '').split('?')[0];
    if (!table) return res.status(400).json({ error: 'No table' });

    if (req.method === 'GET') {
      let q = supabase.from(table).select('*');
      if (query) {
        for (const part of decodeURIComponent(query).split('&')) {
          if (part.startsWith('order=')) {
            const [col, dir] = part.replace('order=', '').split('.');
            q = q.order(col, { ascending: dir !== 'desc' });
          } else if (part.includes('=eq.')) {
            const [col, val] = part.split('=eq.');
            q = q.eq(col, val);
          } else if (part.includes('=is.false')) {
            q = q.eq(part.split('=is.')[0], false);
          }
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
      for (const part of decodeURIComponent(query || '').split('&')) {
        if (part.includes('=eq.')) filters.push(part.split('=eq.'));
      }
      if (!filters.length) return res.status(400).json({ error: 'No filter' });
      const [col, val] = filters[0];
      const { data, error } = await supabase.from(table).update(req.body).eq(col, val).select();
      if (error) throw error;
      return res.status(200).json(data[0]);
    }

    if (req.method === 'DELETE') {
      for (const part of decodeURIComponent(query || '').split('&')) {
        if (part.includes('=eq.')) {
          const [col, val] = part.split('=eq.');
          const { error } = await supabase.from(table).delete().eq(col, val);
          if (error) throw error;
          return res.status(200).json({ success: true });
        }
      }
      return res.status(400).json({ error: 'No filter' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('DB error:', err);
    return res.status(500).json({ error: err.message || err.toString(), code: err.code });
  }
}
