const { getKV, hget, hgetall, hset, hdel } = require('./_kv');

const PASS = process.env.ADMIN_PASSWORD || 'findmeajob2026';

module.exports = async function handler(req, res) {
  const params = req.method === 'GET' ? req.query : req.body;
  const { action, password, id } = params;
  if (password !== PASS) return res.status(401).json({ error: 'Unauthorised' });
  if (!getKV()) return res.status(500).json({ error: 'Database not configured.' });
  try {
    if (action === 'list') {
      const raw = await hgetall('jobs');
      const jobs = Object.values(raw).map(j => typeof j === 'string' ? JSON.parse(j) : j);
      jobs.sort((a, b) => new Date(b.submitted) - new Date(a.submitted));
      return res.status(200).json({ jobs });
    }
    if (action === 'approve') {
      const raw = await hget('jobs', id);
      if (!raw) return res.status(404).json({ error: 'Not found' });
      const job = typeof raw === 'string' ? JSON.parse(raw) : raw;
      job.status = 'approved'; job.approvedAt = new Date().toISOString();
      await hset('jobs', id, job);
      return res.status(200).json({ success: true });
    }
    if (action === 'reject') {
      const raw = await hget('jobs', id);
      if (!raw) return res.status(404).json({ error: 'Not found' });
      const job = typeof raw === 'string' ? JSON.parse(raw) : raw;
      job.status = 'rejected';
      await hset('jobs', id, job);
      return res.status(200).json({ success: true });
    }
    if (action === 'feature') {
      const raw = await hget('jobs', id);
      if (!raw) return res.status(404).json({ error: 'Not found' });
      const job = typeof raw === 'string' ? JSON.parse(raw) : raw;
      job.featured = !job.featured;
      await hset('jobs', id, job);
      return res.status(200).json({ success: true, featured: job.featured });
    }
    if (action === 'delete') {
      await hdel('jobs', id);
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
