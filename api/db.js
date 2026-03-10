import postgres from 'postgres';

const sql = postgres('postgresql://postgres.cafgtjvajulozcvocnurj:D0gH2t9%2511!@aws-0-us-west-2.pooler.supabase.com:5432/postgres', {
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
    // Extract table name from path like /rest/v1/accounts
    const table = path.replace('/rest/v1/', '').split('?')[0];
    if (!table) return res.status(400).json({ error: 'No table specified' });

    // Parse filters from query string e.g. "id=eq.abc&order=name.asc"
    const filters = [];
    const params = {};
    let orderBy = 'created_at DESC';
    let selectCols = '*';

    if (query) {
      const parts = decodeURIComponent(query).split('&');
      for (const part of parts) {
        if (part.startsWith('select=')) {
          selectCols = part.replace('select=', '') || '*';
        } else if (part.startsWith('order=')) {
          const ord = part.replace('order=', '');
          const [col, dir] = ord.split('.');
          orderBy = `${col} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
        } else if (part.includes('=eq.')) {
          const [col, val] = part.split('=eq.');
          filters.push({ col, op: '=', val });
        } else if (part.includes('=neq.')) {
          const [col, val] = part.split('=neq.');
          filters.push({ col, op: '!=', val });
        } else if (part.includes('=is.')) {
          const [col, val] = part.split('=is.');
          filters.push({ col, op: 'IS', val: val === 'false' ? false : val === 'true' ? true : null });
        }
      }
    }

    if (req.method === 'GET') {
      let result;
      if (filters.length === 0) {
        result = await sql`SELECT * FROM ${sql(table)} ORDER BY ${sql(orderBy.split(' ')[0])} ${sql.unsafe(orderBy.split(' ')[1] || 'ASC')}`;
      } else {
        // Build WHERE clause dynamically
        let q = `SELECT * FROM "${table}" WHERE `;
        const vals = [];
        const conditions = filters.map((f, i) => {
          vals.push(f.val);
          return `"${f.col}" ${f.op} $${i + 1}`;
        });
        q += conditions.join(' AND ');
        result = await sql.unsafe(q, vals);
      }
      return res.status(200).json(result);
    }

    if (req.method === 'POST') {
      const body = req.body;
      const rows = Array.isArray(body) ? body : [body];
      const result = await sql`INSERT INTO ${sql(table)} ${sql(rows)} RETURNING *`;
      return res.status(200).json(result);
    }

    if (req.method === 'PATCH') {
      const body = req.body;
      if (filters.length === 0) return res.status(400).json({ error: 'No filter for update' });
      const f = filters[0];
      const result = await sql`UPDATE ${sql(table)} SET ${sql(body, Object.keys(body))} WHERE ${sql(f.col)} = ${f.val} RETURNING *`;
      return res.status(200).json(result);
    }

    if (req.method === 'DELETE') {
      if (filters.length === 0) return res.status(400).json({ error: 'No filter for delete' });
      const f = filters[0];
      await sql`DELETE FROM ${sql(table)} WHERE ${sql(f.col)} = ${f.val}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
