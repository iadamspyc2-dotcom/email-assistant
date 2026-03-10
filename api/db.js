import postgres from 'postgres';

// Use explicit params to avoid URL encoding issues with special chars in password
const sql = postgres({
  host: 'aws-0-us-west-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  username: 'postgres.cafgtjvajulozcvocnurj',
  password: 'D0gH2t9%11!',
  ssl: 'require',
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { path = '', query = '' } = req.query;
    const table = path.replace('/rest/v1/', '').split('?')[0];
    if (!table) return res.status(400).json({ error: 'No table specified' });

    if (req.method === 'GET') {
      let orderCol = 'created_at';
      let orderDir = 'DESC';
      const filters = [];

      if (query) {
        const parts = decodeURIComponent(query).split('&');
        for (const part of parts) {
          if (part.startsWith('order=')) {
            const [col, dir] = part.replace('order=', '').split('.');
            orderCol = col;
            orderDir = dir === 'desc' ? 'DESC' : 'ASC';
          } else if (part.includes('=eq.')) {
            const [col, val] = part.split('=eq.');
            filters.push({ col, val });
          } else if (part === 'dismissed=is.false' || part.includes('=is.false')) {
            const col = part.split('=is.')[0];
            filters.push({ col, val: false, isBoolean: true });
          }
        }
      }

      let result;
      if (filters.length === 0) {
        result = await sql.unsafe(`SELECT * FROM "${table}" ORDER BY "${orderCol}" ${orderDir}`);
      } else {
        const conditions = filters.map((f, i) => `"${f.col}" = $${i + 1}`).join(' AND ');
        const vals = filters.map(f => f.val);
        result = await sql.unsafe(`SELECT * FROM "${table}" WHERE ${conditions} ORDER BY "${orderCol}" ${orderDir}`, vals);
      }
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const rows = Array.isArray(req.body) ? req.body : [req.body];
      const result = await sql`INSERT INTO ${sql(table)} ${sql(rows)} RETURNING *`;
      return res.status(200).json(result);
    }

    if (req.method === 'PATCH') {
      const { path: p, query: q, ...body } = req.body || {};
      const { col, val } = (() => {
        const parts = decodeURIComponent(query || '').split('&');
        for (const part of parts) {
          if (part.includes('=eq.')) {
            const [c, v] = part.split('=eq.');
            return { col: c, val: v };
          }
        }
        return {};
      })();
      if (!col) return res.status(400).json({ error: 'No filter' });
      const updateData = req.body;
      const result = await sql.unsafe(
        `UPDATE "${table}" SET ${Object.keys(updateData).map((k, i) => `"${k}" = $${i + 1}`).join(', ')} WHERE "${col}" = $${Object.keys(updateData).length + 1} RETURNING *`,
        [...Object.values(updateData), val]
      );
      return res.status(200).json(result);
    }

    if (req.method === 'DELETE') {
      const parts = decodeURIComponent(query || '').split('&');
      for (const part of parts) {
        if (part.includes('=eq.')) {
          const [col, val] = part.split('=eq.');
          await sql.unsafe(`DELETE FROM "${table}" WHERE "${col}" = $1`, [val]);
          return res.status(200).json({ success: true });
        }
      }
      return res.status(400).json({ error: 'No filter for delete' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
