export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Prefer');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Debug endpoint - tell us exactly what's happening
  const dbPassword = process.env.DB_PASSWORD;
  const supabaseKey = process.env.SUPABASE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;

  return res.status(200).json({
    hasDbPassword: !!dbPassword,
    dbPasswordLength: dbPassword ? dbPassword.length : 0,
    hasSupabaseKey: !!supabaseKey,
    hasSupabaseUrl: !!supabaseUrl,
    supabaseUrl: supabaseUrl || 'NOT SET',
    nodeVersion: process.version,
  });
}
