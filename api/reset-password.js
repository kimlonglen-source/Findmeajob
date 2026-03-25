const { getKV, hget, hset } = require('./_kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!getKV()) return res.status(500).json({ error: 'Database not configured.' });
  try {
    const { email, tempPassword } = req.body;
    if (!email || !tempPassword) return res.status(400).json({ error: 'Missing fields' });
    const raw = await hget('employers', email);
    if (!raw) return res.status(404).json({ error: 'No account found with that email address.' });
    const emp = typeof raw === 'string' ? JSON.parse(raw) : raw;
    emp.password = tempPassword;
    emp.passwordReset = new Date().toISOString();
    await hset('employers', email, emp);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
