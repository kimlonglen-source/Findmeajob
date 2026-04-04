const { getKV, hget, hgetall, hset } = require('./_kv');

const LAUNCH_END = new Date("2026-10-01T00:00:00Z");
const PLAN_LIMITS = { free: 1, basic: 5, pro: 999 };
const PLAN_DAYS = { free: 30, basic: 60, pro: 90 };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!getKV()) return res.status(500).json({ error: 'Database not configured.' });
  try {
    const { employerId, employerEmail, company, title, location, category, type, salary,
            description, requirements, why, plan, companyProfile, website, logoUrl } = req.body;
    if (!company || !employerEmail || !title || !description)
      return res.status(400).json({ error: 'Missing required fields' });

    const planKey = plan || 'free';
    const isLaunchPeriod = new Date() < LAUNCH_END;

    // During launch: unlimited for all plans
    if (!isLaunchPeriod) {
      const limit = PLAN_LIMITS[planKey] || 1;
      if (limit < 999) {
        const allJobs = await hgetall('jobs');
        const active = Object.values(allJobs)
          .map(j => typeof j === 'string' ? JSON.parse(j) : j)
          .filter(j => j.email === employerEmail && (j.status === 'approved' || j.status === 'pending'));
        if (active.length >= limit) {
          return res.status(400).json({
            error: `Your ${planKey} plan allows ${limit} active listing${limit > 1 ? 's' : ''}. You have ${active.length} active. Upgrade to post more.`,
            limitReached: true
          });
        }
      }
    }

    const id = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const job = {
      id,
      employerId: employerId || '',
      company,
      email: employerEmail,
      title,
      location: location || 'New Zealand',
      category: category || 'Other',
      type: type || 'Full-time',
      salary: salary || 'Negotiable',
      description,
      requirements: requirements || '',
      why: why || '',
      companyProfile: (planKey === 'basic' || planKey === 'pro') ? (companyProfile || '') : '',
      website: website || '',
      logoUrl: (planKey === 'basic' || planKey === 'pro') ? (logoUrl || '') : '',
      plan: planKey,
      planDays: isLaunchPeriod ? 90 : (PLAN_DAYS[planKey] || 30),
      // Pro listings get auto-featured when approved
      autoFeature: planKey === 'pro',
      // Growth+ get priority placement
      priority: planKey === 'basic' || planKey === 'pro',
      status: 'pending',
      submitted: new Date().toISOString(),
      views: 0,
      applies: 0
    };

    await hset('jobs', id, job);
    return res.status(200).json({ success: true, id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save: ' + err.message });
  }
};
