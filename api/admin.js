var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hgetall = _kv.hgetall;
var hset = _kv.hset;
var hdel = _kv.hdel;

var PASS = process.env.ADMIN_PASSWORD;
var LAUNCH_END = new Date("2026-10-01T00:00:00Z");
var PLAN_DAYS = { free: 30, basic: 60, pro: 90 };

var rateLimitMap = {};

function checkRateLimit(ip) {
  var now = Date.now();
  if (!rateLimitMap[ip] || rateLimitMap[ip].resetAt < now) {
    rateLimitMap[ip] = { count: 1, resetAt: now + 60000 };
    return true;
  }
  rateLimitMap[ip].count++;
  if (rateLimitMap[ip].count > 5) return false;
  return true;
}

module.exports = async function handler(req, res) {
  if (!PASS) return res.status(500).json({ error: "ADMIN_PASSWORD environment variable is not set" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed. Use POST." });

  var ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "unknown";
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  }

  var params = req.body;
  var action = params.action;
  var password = params.password;
  var id = params.id;
  if (password !== PASS) return res.status(401).json({ error: "Unauthorised" });
  if (!getKV()) return res.status(500).json({ error: "Database not configured." });
  try {
    if (action === "list") {
      var raw = await hgetall("jobs");
      var jobs = Object.values(raw).map(function(j) { return typeof j === "string" ? JSON.parse(j) : j; });
      jobs.sort(function(a, b) { return new Date(b.submitted) - new Date(a.submitted); });
      return res.status(200).json({ jobs: jobs });
    }
    if (action === "approve") {
      var raw2 = await hget("jobs", id);
      if (!raw2) return res.status(404).json({ error: "Not found" });
      var job = typeof raw2 === "string" ? JSON.parse(raw2) : raw2;
      job.status = "approved";
      job.approvedAt = new Date().toISOString();
      // Auto-feature Pro listings
      if (job.autoFeature || job.plan === "pro") job.featured = true;
      // During launch period, all plans get 90 days
      job.planDays = (new Date() < LAUNCH_END) ? 90 : (PLAN_DAYS[job.plan] || 30);
      await hset("jobs", id, job);
      return res.status(200).json({ success: true });
    }
    if (action === "reject") {
      var raw3 = await hget("jobs", id);
      if (!raw3) return res.status(404).json({ error: "Not found" });
      var job2 = typeof raw3 === "string" ? JSON.parse(raw3) : raw3;
      job2.status = "rejected";
      await hset("jobs", id, job2);
      return res.status(200).json({ success: true });
    }
    if (action === "feature") {
      var raw4 = await hget("jobs", id);
      if (!raw4) return res.status(404).json({ error: "Not found" });
      var job3 = typeof raw4 === "string" ? JSON.parse(raw4) : raw4;
      job3.featured = !job3.featured;
      await hset("jobs", id, job3);
      return res.status(200).json({ success: true, featured: job3.featured });
    }
    if (action === "relist") {
      var raw5 = await hget("jobs", id);
      if (!raw5) return res.status(404).json({ error: "Not found" });
      var job4 = typeof raw5 === "string" ? JSON.parse(raw5) : raw5;
      job4.status = "approved";
      job4.approvedAt = new Date().toISOString();
      job4.planDays = (new Date() < LAUNCH_END) ? 90 : (PLAN_DAYS[job4.plan] || 30);
      if (job4.plan === "pro") job4.featured = true;
      await hset("jobs", id, job4);
      return res.status(200).json({ success: true });
    }
    if (action === "delete") {
      await hdel("jobs", id);
      return res.status(200).json({ success: true });
    }
    if (action === "list-seekers") {
      var seekerRaw = await hgetall("seekers");
      var seekers = Object.values(seekerRaw).map(function(s) { var sk = typeof s === "string" ? JSON.parse(s) : s; return { id: sk.id, name: sk.name, email: sk.email, phone: sk.phone || "", rtw: sk.rtw || "", hasCv: !!(sk.cvText || sk.cvFileName), createdAt: sk.createdAt }; });
      seekers.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      return res.status(200).json({ seekers: seekers });
    }
    if (action === "list-employers") {
      var empRaw = await hgetall("employers");
      var employers = Object.values(empRaw).map(function(e) { var em = typeof e === "string" ? JSON.parse(e) : e; return { id: em.id, name: em.name, company: em.company, email: em.email, phone: em.phone || "", plan: em.plan || "free", registered: em.registered }; });
      employers.sort(function(a, b) { return new Date(b.registered) - new Date(a.registered); });
      return res.status(200).json({ employers: employers });
    }
    if (action === "stats") {
      var sRaw = await hgetall("seekers");
      var eRaw = await hgetall("employers");
      var jRaw = await hgetall("jobs");
      var aRaw = await hgetall("applications");
      var seekerCount = Object.keys(sRaw).length;
      var employerCount = Object.keys(eRaw).length;
      var jobCount = Object.keys(jRaw).length;
      var appCount = 0;
      Object.values(aRaw).forEach(function(v) {
        try { var arr = typeof v === "string" ? JSON.parse(v) : v; if (Array.isArray(arr)) appCount += arr.length; } catch(e) {}
      });
      return res.status(200).json({ seekers: seekerCount, employers: employerCount, jobs: jobCount, applications: appCount });
    }
    if (action === "delete-seeker") {
      var email = params.email;
      if (!email) return res.status(400).json({ error: "Email required" });
      await hdel("seekers", email);
      await hdel("applications", email);
      return res.status(200).json({ success: true });
    }
    if (action === "delete-employer") {
      var email2 = params.email;
      if (!email2) return res.status(400).json({ error: "Email required" });
      // Also delete their job listings
      var jobRaw = await hgetall("jobs");
      var delCount = 0;
      for (var jk in jobRaw) {
        var jb = typeof jobRaw[jk] === "string" ? JSON.parse(jobRaw[jk]) : jobRaw[jk];
        if (jb.email === email2) { await hdel("jobs", jk); delCount++; }
      }
      await hdel("employers", email2);
      return res.status(200).json({ success: true, deletedJobs: delCount });
    }
    if (action === "update-employer") {
      var email3 = params.email;
      var newPlan = params.plan;
      if (!email3) return res.status(400).json({ error: "Email required" });
      var empData = await hget("employers", email3);
      if (!empData) return res.status(404).json({ error: "Employer not found" });
      var emp = typeof empData === "string" ? JSON.parse(empData) : empData;
      if (newPlan && ["free", "basic", "pro"].indexOf(newPlan) !== -1) {
        emp.plan = newPlan;
        emp.planChangedAt = new Date().toISOString();
      }
      await hset("employers", email3, emp);
      return res.status(200).json({ success: true });
    }
    if (action === "email-user") {
      var resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) return res.status(500).json({ error: "Email service not configured" });
      var toEmail = params.to;
      var subject = params.subject;
      var body = params.body;
      if (!toEmail || !subject || !body) return res.status(400).json({ error: "to, subject, and body required" });
      var emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + resendKey },
        body: JSON.stringify({
          from: "FindMeAJob <hello@findmeajob.co.nz>",
          to: [toEmail],
          subject: subject,
          html: '<div style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333">' + body.replace(/\n/g, '<br>') + '<br><br><span style="color:#999;font-size:13px">— FindMeAJob.co.nz</span></div>'
        })
      });
      if (!emailRes.ok) {
        var errBody = await emailRes.text();
        return res.status(500).json({ error: "Failed to send: " + errBody });
      }
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
