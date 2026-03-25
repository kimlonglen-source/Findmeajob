const { hgetall } = require('./_kv');

const PLAN_DAYS = { free: 30, basic: 60, pro: 90 };

module.exports = async function handler(req, res) {
  try {
    const raw = await hgetall('jobs');
    const now = new Date();
    const jobs = Object.values(raw)
      .map(j => typeof j === 'string' ? JSON.parse(j) : j)
      .filter(j => {
        if (j.status !== 'approved') return false;
        // Check expiry
        const start = j.approvedAt || j.submitted;
        const days = j.planDays || PLAN_DAYS[j.plan] || 30;
        const expiry = new Date(new Date(start).getTime() + days * 24 * 60 * 60 * 1000);
        return now < expiry;
      })
      .sort((a, b) => {
        // Featured first (Pro auto-featured)
        if (b.featured && !a.featured) return 1;
        if (a.featured && !b.featured) return -1;
        // Then priority (Growth+)
        if (b.priority && !a.priority) return 1;
        if (a.priority && !b.priority) return -1;
        // Then newest
        return new Date(b.approvedAt || b.submitted) - new Date(a.approvedAt || a.submitted);
      });
    return res.status(200).json({ jobs });
  } catch (err) {
    return res.status(200).json({ jobs: [] });
  }
};
