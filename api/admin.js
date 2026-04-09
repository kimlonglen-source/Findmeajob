var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hgetall = _kv.hgetall;
var hset = _kv.hset;
var hdel = _kv.hdel;

var PASS = process.env.ADMIN_PASSWORD;
var LAUNCH_END = new Date("2026-10-01T00:00:00Z");
var PLAN_DAYS = { free: 30, basic: 60, pro: 90 };

function notifyEmployer(email, subject, bodyHtml) {
  var resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !email) return;
  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + resendKey },
    body: JSON.stringify({
      from: "FindMeAJob <hello@findmeajob.co.nz>",
      to: [email],
      subject: subject,
      html: '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">'
        + '<div style="background:#10b981;color:#fff;padding:1rem 1.5rem;border-radius:12px 12px 0 0;font-size:16px;font-weight:700">FindMeAJob.co.nz</div>'
        + '<div style="background:#f8f9fa;border:1px solid #e5e7eb;border-top:none;padding:1.5rem;border-radius:0 0 12px 12px">'
        + bodyHtml
        + '<div style="margin-top:1.5rem;padding-top:1rem;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af">Questions? Reply to this email or contact <a href="mailto:hello@findmeajob.co.nz" style="color:#059669">hello@findmeajob.co.nz</a></div>'
        + '</div></div>'
    })
  }).catch(function() {});
}

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
      notifyEmployer(job.email,
        'Your listing "' + (job.title || 'Untitled') + '" is now live',
        '<p style="font-size:15px;line-height:1.7;margin:0 0 1rem">Hi,</p>'
        + '<p style="font-size:15px;line-height:1.7;margin:0 0 1rem">Your job listing <strong>' + esc(job.title) + '</strong> has been approved and is now live on FindMeAJob.co.nz.</p>'
        + '<p style="font-size:15px;line-height:1.7;margin:0 0 1rem">It will be visible for ' + (job.planDays || 30) + ' days. Applications will be sent directly to your email.</p>'
        + '<p style="margin-top:1rem"><a href="https://www.findmeajob.co.nz/employer-portal.html" style="display:inline-block;background:#10b981;color:#fff;padding:10px 20px;border-radius:20px;font-size:14px;font-weight:700;text-decoration:none">View your dashboard</a></p>'
      );
      return res.status(200).json({ success: true });
    }
    if (action === "reject") {
      var raw3 = await hget("jobs", id);
      if (!raw3) return res.status(404).json({ error: "Not found" });
      var job2 = typeof raw3 === "string" ? JSON.parse(raw3) : raw3;
      job2.status = "rejected";
      await hset("jobs", id, job2);
      notifyEmployer(job2.email,
        'Your listing "' + (job2.title || 'Untitled') + '" needs changes',
        '<p style="font-size:15px;line-height:1.7;margin:0 0 1rem">Hi,</p>'
        + '<p style="font-size:15px;line-height:1.7;margin:0 0 1rem">Your job listing <strong>' + esc(job2.title) + '</strong> has been reviewed and could not be approved in its current form.</p>'
        + '<p style="font-size:15px;line-height:1.7;margin:0 0 1rem">This may be due to missing details, unclear requirements, or content that doesn\'t meet our listing guidelines.</p>'
        + '<p style="font-size:15px;line-height:1.7;margin:0 0 1rem">You can edit and resubmit your listing from your employer dashboard — no need to start over.</p>'
        + '<p style="margin-top:1rem"><a href="https://www.findmeajob.co.nz/employer-portal.html" style="display:inline-block;background:#10b981;color:#fff;padding:10px 20px;border-radius:20px;font-size:14px;font-weight:700;text-decoration:none">Edit and resubmit</a></p>'
      );
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
      var rawDel = await hget("jobs", id);
      if (rawDel) {
        var jobDel = typeof rawDel === "string" ? JSON.parse(rawDel) : rawDel;
        notifyEmployer(jobDel.email,
          'Your listing "' + (jobDel.title || 'Untitled') + '" has been removed',
          '<p style="font-size:15px;line-height:1.7;margin:0 0 1rem">Hi,</p>'
          + '<p style="font-size:15px;line-height:1.7;margin:0 0 1rem">Your job listing <strong>' + esc(jobDel.title) + '</strong> has been removed from FindMeAJob.co.nz as it did not meet our listing guidelines.</p>'
          + '<p style="font-size:15px;line-height:1.7;margin:0 0 1rem">If you believe this was an error, please contact us at <a href="mailto:hello@findmeajob.co.nz" style="color:#059669;text-decoration:none;font-weight:600">hello@findmeajob.co.nz</a>.</p>'
        );
      }
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
      // Also count from job.applies (server-side tracking, more reliable)
      var jobAppCount = 0;
      Object.values(jRaw).forEach(function(v) {
        try { var j = typeof v === "string" ? JSON.parse(v) : v; jobAppCount += (j.applies || 0); } catch(e) {}
      });
      if (jobAppCount > appCount) appCount = jobAppCount;
      var cvUploads = await hget("stats", "cv-uploads");
      return res.status(200).json({ seekers: seekerCount, employers: employerCount, jobs: jobCount, applications: appCount, cvUploads: parseInt(cvUploads) || 0 });
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

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
