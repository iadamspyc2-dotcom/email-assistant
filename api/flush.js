// api/flush.js
// One-time utility to clear all emails from Redis
// DELETE this file after use!

export default async function handler(req, res) {
  const redisUrl = process.env.KV_REST_API_URL;
  const redisToken = process.env.KV_REST_API_TOKEN;

  if (!redisUrl || !redisToken) {
    return res.status(500).json({ error: 'Storage not configured' });
  }

  await fetch(`${redisUrl}/del/emails`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${redisToken}` },
  });

  return res.status(200).json({ success: true, message: 'emails key deleted' });
}
