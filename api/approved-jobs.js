const { hgetall } = require('./_kv');

module.exports = async function handler(req, res) {
  try {
    const raw = await hgetall('jobs');
    const jobs = Object.values(raw)
      .map(j => typeof j === 'string' ? JSON.parse(j) : j)
      .filter(j => j.status === 'approved')
      .sort((a, b) => {
        if (b.featured && !a.featured) return 1;
        if (a.featured && !b.featured) return -1;
        return new Date(b.approvedAt || b.submitted) - new Date(a.approvedAt || a.submitted);
      });
    return res.status(200).json({ jobs });
  } catch (err) {
    return res.status(200).json({ jobs: [] });
  }
};
