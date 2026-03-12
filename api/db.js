const { Pool } = require('pg');

const pool = new Pool({
  connectionString: `postgresql://postgres.cafgtjvajulozcvocnurj:${process.env.DB_PASSWORD}@aws-0-us-west-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const client = await pool.connect();
  try {
    const { path = '', query = '' } = req.query;
    const table = path.replace('/rest/v1/', '').split('?')[0];
    if (!table) return res.status(400).json({ error: 'No table' });

    if (req.method === 'GET') {
      let orderCol = 'created_at', orderDir = 'DESC';
      const filters = [];
      if (query) {
        for (const part of decodeURIComponent(query).split('&')) {
          if (part.startsWith('order=')) {
            const [col, dir] = part.replace('order=', '').split('.');
            orderCol = col; orderDir = dir === 'desc' ? 'DESC' : 'ASC';
          } else if (part.includes('=eq.')) {
            const [col, val] = part.split('=eq.');
            filters.push([col, val]);
          } else if (part.includes('=is.false')) {
            filters.push([part.split('=is.')[0], 'false']);
          }
        }
      }
      const where = filters.length ? 'WHERE ' + filters.map((f,i) => `"${f[0]}" = $${i+1}`).join(' AND ') : '';
      const vals = filters.map(f => f[1]);
      const result = await client.query(`SELECT * FROM "${table}" ${where} ORDER BY "${orderCol}" ${orderDir}`, vals);
      return res.status(200).json(result.rows);
    }

    if (req.method === 'POST') {
      const rows = Array.isArray(req.body) ? req.body : [req.body];
      const results = [];
      for (const row of rows) {
        const keys = Object.keys(row);
        const vals = Object.values(row);
        const placeholders = keys.map((_, i) => `$${i+1}`).join(', ');
        const cols = keys.map(k => `"${k}"`).join(', ');
        const r = await client.query(`INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) RETURNING *`, vals);
        results.push(r.rows[0]);
      }
      return res.status(200).json(results.length === 1 ? results[0] : results);
    }

    if (req.method === 'PATCH') {
      const filters = [];
      for (const part of decodeURIComponent(query || '').split('&')) {
        if (part.includes('=eq.')) { const [c,v] = part.split('=eq.'); filters.push([c,v]); }
      }
      if (!filters.length) return res.status(400).json({ error: 'No filter' });
      const [col, val] = filters[0];
      const body = req.body;
      const keys = Object.keys(body);
      const sets = keys.map((k,i) => `"${k}" = $${i+1}`).join(', ');
      const r = await client.query(
        `UPDATE "${table}" SET ${sets} WHERE "${col}" = $${keys.length+1} RETURNING *`,
        [...Object.values(body), val]
      );
      return res.status(200).json(r.rows[0]);
    }

    if (req.method === 'DELETE') {
      for (const part of decodeURIComponent(query || '').split('&')) {
        if (part.includes('=eq.')) {
          const [col, val] = part.split('=eq.');
          await client.query(`DELETE FROM "${table}" WHERE "${col}" = $1`, [val]);
          return res.status(200).json({ success: true });
        }
      }
      return res.status(400).json({ error: 'No filter' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message, code: err.code });
  } finally {
    client.release();
  }
};
