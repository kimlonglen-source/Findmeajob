const { getKV, hget } = require('./_kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!getKV()) return res.status(500).json({ error: 'Database not configured.' });
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing email or password.' });
    const raw = await hget('employers', email);
    if (!raw) return res.status(401).json({ error: 'No account found with that email address.' });
    const emp = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (emp.password !== password) return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    return res.status(200).json({
      success: true,
      id: emp.id,
      name: emp.name,
      company: emp.company,
      email: emp.email,
      plan: emp.plan || 'free'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
