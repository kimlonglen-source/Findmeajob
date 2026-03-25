const { getKV, hset } = require('./_kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!getKV()) return res.status(500).json({ error: 'Database not configured.' });
  try {
    const { employerId, employerEmail, company, title, location, category, type, salary, description, requirements, why, plan } = req.body;
    if (!company || !employerEmail || !title || !description) return res.status(400).json({ error: 'Missing required fields' });
    const id = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const job = { id, employerId: employerId || '', company, email: employerEmail, title, location: location || 'New Zealand', category: category || 'Other', type: type || 'Full-time', salary: salary || 'Negotiable', description, requirements: requirements || '', why: why || '', plan: plan || 'free', status: 'pending', submitted: new Date().toISOString() };
    await hset('jobs', id, job);
    return res.status(200).json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save: ' + err.message });
  }
};
