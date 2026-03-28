var _kv = require('./_kv');
var getKV = _kv.getKV;
var hget = _kv.hget;
var hgetall = _kv.hgetall;
var hset = _kv.hset;

var PLAN_LIMITS = { free: 1, basic: 5, pro: 999 };
var PLAN_DAYS = { free: 30, basic: 60, pro: 90 };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!getKV()) return res.status(500).json({ error: 'Database not configured.' });
  try {
    var body = req.body;
    var employerId = body.employerId;
    var employerEmail = body.employerEmail;
    var company = body.company;
    var title = body.title;
    var location = body.location;
    var category = body.category;
    var type = body.type;
    var salary = body.salary;
    var description = body.description;
    var requirements = body.requirements;
    var why = body.why;
    var companyProfile = body.companyProfile;
    var website = body.website;
    var logoUrl = body.logoUrl;
    if (!company || !employerEmail || !title || !description)
      return res.status(400).json({ error: 'Missing required fields' });

    // Get the ACTUAL plan from the employer record (not from request body)
    var empRaw = await hget('employers', employerEmail);
    var planKey = 'free';
    if (empRaw) {
      var emp = typeof empRaw === 'string' ? JSON.parse(empRaw) : empRaw;
      planKey = emp.plan || 'free';
    }

    // Check listing limit
    var limit = PLAN_LIMITS[planKey] || 1;
    if (limit < 999) {
      var allJobs = await hgetall('jobs');
      var active = Object.values(allJobs)
        .map(function(j) { return typeof j === 'string' ? JSON.parse(j) : j; })
        .filter(function(j) { return j.email === employerEmail && (j.status === 'approved' || j.status === 'pending'); });
      if (active.length >= limit) {
        var planNames = {free: 'Starter', basic: 'Growth', pro: 'Pro'};
        return res.status(400).json({
          error: 'Your ' + (planNames[planKey] || planKey) + ' plan allows ' + limit + ' active listing' + (limit > 1 ? 's' : '') + '. You have ' + active.length + ' active. Upgrade your plan to post more.',
          limitReached: true
        });
      }
    }

    var id = 'job_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    var job = {
      id: id,
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
      companyProfile: companyProfile || '',
      website: website || '',
      logoUrl: logoUrl || '',
      plan: planKey,
      planDays: PLAN_DAYS[planKey] || 30,
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
