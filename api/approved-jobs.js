var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hset = _kv.hset;
var hgetall = _kv.hgetall;

var PLAN_DAYS = { free: 30, basic: 60, pro: 90 };

var statsCache = { data: null, expires: 0 };

module.exports = async function handler(req, res) {
  // POST = track event
  if (req.method === "POST") {
    if (!getKV()) return res.status(200).json({ ok: true });
    try {
      var jobId = req.body.jobId;
      var type = req.body.type;
      if (!jobId || !type) return res.status(200).json({ ok: true });
      if (type !== "view" && type !== "apply") return res.status(200).json({ ok: true });
      var raw = await hget("jobs", jobId);
      if (!raw) return res.status(200).json({ ok: true });
      var job = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (type === "view") job.views = (job.views || 0) + 1;
      if (type === "apply") job.applies = (job.applies || 0) + 1;
      await hset("jobs", jobId, job);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(200).json({ ok: true });
    }
  }

  // GET ?stats=1 = public job count
  if (req.query && req.query.stats === "1") {
    var sNow = Date.now();
    if (statsCache.data && sNow < statsCache.expires) return res.status(200).json(statsCache.data);
    try {
      var sResult = { liveJobs: 0, adzunaJobs: 0, totalJobs: 0 };
      if (getKV()) {
        var sRaw = await hgetall("jobs");
        var sDate = new Date();
        sResult.liveJobs = Object.values(sRaw).map(function(j){return typeof j==="string"?JSON.parse(j):j;}).filter(function(j){
          if(j.status!=="approved")return false;var start=j.approvedAt||j.submitted;var days=j.planDays||PLAN_DAYS[j.plan]||30;
          return sDate<new Date(new Date(start).getTime()+days*24*60*60*1000);
        }).length;
      }
      var appId=process.env.ADZUNA_APP_ID,appKey=process.env.ADZUNA_APP_KEY;
      if(appId&&appKey){try{var ar=await fetch("https://api.adzuna.com/v1/api/jobs/nz/search/1?app_id="+appId+"&app_key="+appKey+"&results_per_page=1&what=jobs&location0=New+Zealand",{headers:{"Accept":"application/json"}});if(ar.ok){var ad=await ar.json();sResult.adzunaJobs=ad.count||0;}}catch(e){}}
      sResult.totalJobs = sResult.liveJobs + sResult.adzunaJobs;
      statsCache.data = sResult; statsCache.expires = sNow + 300000;
      return res.status(200).json(sResult);
    } catch(e) { return res.status(200).json({ liveJobs:0, adzunaJobs:0, totalJobs:0 }); }
  }

  // GET = list approved jobs
  try {
    var allRaw = await hgetall("jobs");
    var now = new Date();
    var jobs = Object.values(allRaw)
      .map(function(j) { return typeof j === "string" ? JSON.parse(j) : j; })
      .filter(function(j) {
        if (j.status !== "approved") return false;
        var start = j.approvedAt || j.submitted;
        var days = j.planDays || PLAN_DAYS[j.plan] || 30;
        var expiry = new Date(new Date(start).getTime() + days * 24 * 60 * 60 * 1000);
        return now < expiry;
      })
      .sort(function(a, b) {
        if (b.featured && !a.featured) return 1;
        if (a.featured && !b.featured) return -1;
        if (b.priority && !a.priority) return 1;
        if (a.priority && !b.priority) return -1;
        return new Date(b.approvedAt || b.submitted) - new Date(a.approvedAt || a.submitted);
      });
    return res.status(200).json({ jobs: jobs });
  } catch (err) {
    console.error("approved-jobs error:", err);
    return res.status(200).json({ jobs: [] });
  }
};
