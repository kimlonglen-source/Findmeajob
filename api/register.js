const { getKV, hget, hset } = require('./_kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!getKV()) return res.status(500).json({ error: 'Database not configured. Add KV_REST_API_URL and KV_REST_API_TOKEN in Vercel environment variables.' });
  try {
    const { name, company, email, phone, website, password } = req.body;
    if (!name || !company || !email || !password) return res.status(400).json({ error: 'Missing required fields' });
    const existing = await hget('employers', email);
    if (existing) return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
    const id = 'emp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const employer = { id, name, company, email, phone: phone || '', website: website || '', password, status: 'active', registered: new Date().toISOString() };
    await hset('employers', email, employer);
    return res.status(200).json({ success: true, id, name, company, email });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
};
