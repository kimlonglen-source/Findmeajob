const { getKV, hget, hset } = require('./_kv');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!getKV()) return res.status(200).json({ ok: true });
  try {
    const { jobId, type } = req.body; // type: 'view' or 'apply'
    if (!jobId || !type) return res.status(200).json({ ok: true });
    const raw = await hget('jobs', jobId);
    if (!raw) return res.status(200).json({ ok: true });
    const job = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (type === 'view') job.views = (job.views || 0) + 1;
    if (type === 'apply') job.applies = (job.applies || 0) + 1;
    await hset('jobs', jobId, job);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(200).json({ ok: true });
  }
};
