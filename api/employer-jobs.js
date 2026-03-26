const { getKV, hget, hgetall, hset } = require('./_kv');

module.exports = async function handler(req, res) {
  if (!getKV()) return res.status(500).json({ error: 'Database not configured.' });

  // GET - fetch employer's jobs
  if (req.method === 'GET') {
    const { email, password } = req.query;
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
    try {
      const empRaw = await hget('employers', email);
      if (!empRaw) return res.status(401).json({ error: 'Account not found' });
      const emp = typeof empRaw === 'string' ? JSON.parse(empRaw) : empRaw;
      if (emp.password !== password) return res.status(401).json({ error: 'Incorrect password' });
      const raw = await hgetall('jobs');
      const jobs = Object.values(raw)
        .map(j => typeof j === 'string' ? JSON.parse(j) : j)
        .filter(j => j.email === email)
        .sort((a, b) => new Date(b.submitted) - new Date(a.submitted));
      return res.status(200).json({ success: true, employer: { name: emp.name, company: emp.company, email: emp.email, plan: emp.plan || 'free' }, jobs });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST - edit or relist
  if (req.method === 'POST') {
    const { action, email, password, jobId, updates } = req.body;
    if (!email || !password || !jobId) return res.status(400).json({ error: 'Missing fields' });
    try {
      const empRaw = await hget('employers', email);
      if (!empRaw) return res.status(401).json({ error: 'Account not found' });
      const emp = typeof empRaw === 'string' ? JSON.parse(empRaw) : empRaw;
      if (emp.password !== password) return res.status(401).json({ error: 'Incorrect password' });
      const jobRaw = await hget('jobs', jobId);
      if (!jobRaw) return res.status(404).json({ error: 'Job not found' });
      const job = typeof jobRaw === 'string' ? JSON.parse(jobRaw) : jobRaw;
      if (job.email !== email) return res.status(403).json({ error: 'Not your listing' });

      if (action === 'edit') {
        if (job.status === 'approved') return res.status(400).json({ error: 'Cannot edit a live listing. Contact hello@findmeajob.co.nz' });
        const allowed = ['title','location','category','type','salary','description','requirements','why'];
        allowed.forEach(k => { if (updates[k] !== undefined) job[k] = updates[k]; });
        job.status = 'pending';
        job.editedAt = new Date().toISOString();
        job.editNote = 'Resubmitted by employer after edit';
        await hset('jobs', jobId, job);
        return res.status(200).json({ success: true });
      }

      if (action === 'relist') {
        if (job.status !== 'approved') return res.status(400).json({ error: 'Only live listings can be relisted' });
        job.approvedAt = new Date().toISOString();
        job.featured = false;
        await hset('jobs', jobId, job);
        return res.status(200).json({ success: true });
      }

      if (action === 'close') {
        job.status = 'closed';
        job.closedAt = new Date().toISOString();
        await hset('jobs', jobId, job);
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
