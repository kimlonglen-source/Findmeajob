var _kv = require("./_kv");
var hgetall = _kv.hgetall;

var PLAN_DAYS = { free: 30, basic: 60, pro: 90 };

module.exports = async function handler(req, res) {
  // Verify cron secret or admin password
  var authHeader = req.headers.authorization;
  var cronSecret = process.env.CRON_SECRET;
  var adminPass = process.env.ADMIN_PASSWORD;
  var isAuthed = false;
  if (cronSecret && authHeader === "Bearer " + cronSecret) isAuthed = true;
  if (adminPass && req.body && req.body.password === adminPass) isAuthed = true;
  if (cronSecret && req.query && req.query.secret === cronSecret) isAuthed = true;
  if (!isAuthed) return res.status(401).json({ error: "Unauthorised" });

  var resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: "Email not configured" });

  // Only send on Mondays (NZ time)
  var now = new Date();
  var nzDay = new Date(now.toLocaleString("en-US", { timeZone: "Pacific/Auckland" })).getDay();
  var forceRun = req.query && req.query.force === "1";
  if (nzDay !== 1 && !forceRun) return res.status(200).json({ skipped: true, reason: "Not Monday in NZ", day: nzDay });

  try {
    // Get all seekers who opted in to alerts
    var seekersRaw = await hgetall("seekers");
    var seekers = Object.values(seekersRaw)
      .map(function(s) { return typeof s === "string" ? JSON.parse(s) : s; })
      .filter(function(s) { return s.emailAlerts && s.email; });

    if (!seekers.length) return res.status(200).json({ sent: 0, reason: "No seekers opted in" });

    // Get approved jobs from the last 7 days
    var jobsRaw = await hgetall("jobs");
    var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    var recentJobs = Object.values(jobsRaw)
      .map(function(j) { return typeof j === "string" ? JSON.parse(j) : j; })
      .filter(function(j) {
        if (j.status !== "approved") return false;
        var start = j.approvedAt || j.submitted;
        var days = j.planDays || PLAN_DAYS[j.plan] || 30;
        var expiry = new Date(new Date(start).getTime() + days * 24 * 60 * 60 * 1000);
        if (now > expiry) return false;
        return new Date(j.approvedAt || j.submitted) > weekAgo;
      })
      .sort(function(a, b) {
        if (b.featured && !a.featured) return 1;
        if (a.featured && !b.featured) return -1;
        return new Date(b.approvedAt || b.submitted) - new Date(a.approvedAt || a.submitted);
      });

    if (!recentJobs.length) return res.status(200).json({ sent: 0, reason: "No new jobs this week" });

    var sent = 0;
    var errors = 0;

    for (var i = 0; i < seekers.length; i++) {
      var seeker = seekers[i];
      // Keyword match: compare seeker CV text against job titles and descriptions
      var cvText = (seeker.cvText || "").toLowerCase();
      var matched = [];

      if (cvText.length > 20) {
        // Extract keywords from CV (words > 4 chars, skip common words)
        var stopWords = ["about","after","their","there","these","those","would","could","should","which","where","other","being","doing","having","going","coming","making","taking","working","looking"];
        var cvWords = cvText.split(/\s+/).filter(function(w) {
          return w.length > 4 && stopWords.indexOf(w) === -1;
        });
        var uniqueWords = [];
        cvWords.forEach(function(w) { if (uniqueWords.indexOf(w) === -1) uniqueWords.push(w); });
        uniqueWords = uniqueWords.slice(0, 50);

        recentJobs.forEach(function(job) {
          var jobText = ((job.title || "") + " " + (job.description || "") + " " + (job.category || "")).toLowerCase();
          var score = 0;
          uniqueWords.forEach(function(w) { if (jobText.indexOf(w) !== -1) score++; });
          if (score >= 2) matched.push({ job: job, score: score });
        });
        matched.sort(function(a, b) { return b.score - a.score; });
        matched = matched.slice(0, 5);
      }

      // If no CV or no keyword matches, send top featured/recent jobs
      var jobsToSend = matched.length ? matched.map(function(m) { return m.job; }) : recentJobs.slice(0, 5);
      if (!jobsToSend.length) continue;

      // Build email
      var html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">';
      html += '<div style="background:#10b981;color:#fff;padding:1.25rem 1.5rem;border-radius:12px 12px 0 0">';
      html += '<div style="font-size:18px;font-weight:800">New NZ jobs for you this week</div>';
      html += '<div style="font-size:13px;opacity:.85;margin-top:4px">FindMeAJob.co.nz \u2014 Weekly Job Alert</div>';
      html += '</div>';
      html += '<div style="background:#f8f9fa;border:1px solid #e5e7eb;border-top:none;padding:1.5rem;border-radius:0 0 12px 12px">';

      if (seeker.name) html += '<div style="font-size:14px;color:#374151;margin-bottom:1rem">Hi ' + esc(seeker.name) + ', here are ' + jobsToSend.length + ' new jobs ' + (matched.length ? 'matching your profile' : 'posted this week') + ':</div>';

      jobsToSend.forEach(function(job, idx) {
        html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:.75rem">';
        if (job.featured) html += '<div style="font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;margin-bottom:4px">\u2b50 Featured</div>';
        html += '<div style="font-size:16px;font-weight:700;color:#111">' + esc(job.title) + '</div>';
        html += '<div style="font-size:13px;color:#059669;font-weight:600;margin-top:2px">' + esc(job.company) + '</div>';
        html += '<div style="font-size:13px;color:#6b7280;margin-top:2px">' + esc(job.location) + ' \u00b7 ' + esc(job.type || "Full-time") + ' \u00b7 ' + esc(job.salary || "Negotiable") + '</div>';
        html += '<div style="font-size:13px;color:#374151;margin-top:8px;line-height:1.6">' + esc((job.description || "").substring(0, 150)) + '...</div>';
        html += '<div style="margin-top:10px"><a href="https://www.findmeajob.co.nz/?job=' + encodeURIComponent(job.id) + '" style="display:inline-block;background:#10b981;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:700;text-decoration:none">View &amp; Apply</a></div>';
        html += '</div>';
      });

      html += '<div style="text-align:center;margin-top:1rem"><a href="https://www.findmeajob.co.nz/#browse" style="color:#059669;font-size:13px;font-weight:600;text-decoration:none">Browse all NZ jobs \u2192</a></div>';
      var unsubUrl = 'https://www.findmeajob.co.nz/api/seeker?action=unsubscribe&email=' + encodeURIComponent(seeker.email);
      html += '<div style="text-align:center;margin-top:1.5rem;padding-top:1rem;border-top:1px solid #e5e7eb">';
      html += '<div style="font-size:11px;color:#9ca3af">You received this because you opted in to weekly job alerts on <a href="https://www.findmeajob.co.nz" style="color:#059669;text-decoration:none">FindMeAJob.co.nz</a>.</div>';
      html += '<div style="font-size:11px;color:#9ca3af;margin-top:4px"><a href="' + unsubUrl + '" style="color:#9ca3af;text-decoration:underline">Unsubscribe from job alerts</a> | <a href="https://www.findmeajob.co.nz/#account" style="color:#9ca3af;text-decoration:underline">Manage preferences</a></div>';
      html += '<div style="font-size:10px;color:#d1d5db;margin-top:6px">FindMeAJob.co.nz \u2014 New Zealand</div>';
      html += '</div></div></div>';

      try {
        var emailR = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "FindMeAJob Alerts <alerts@findmeajob.co.nz>",
            to: [seeker.email],
            subject: jobsToSend.length + " new NZ jobs matching your profile",
            html: html
          })
        });
        if (emailR.ok) sent++;
        else errors++;
      } catch (e) { errors++; }
    }

    return res.status(200).json({ success: true, sent: sent, errors: errors, seekersChecked: seekers.length, newJobs: recentJobs.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
