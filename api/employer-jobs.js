var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hgetall = _kv.hgetall;
var hset = _kv.hset;

module.exports = async function handler(req, res) {
  if (!getKV()) return res.status(500).json({ error: "Database not configured." });

  // GET - fetch employer jobs
  if (req.method === "GET") {
    var email = req.query.email;
    var password = req.query.password;
    if (!email || !password) return res.status(400).json({ error: "Missing credentials" });
    try {
      var empRaw = await hget("employers", email);
      if (!empRaw) return res.status(401).json({ error: "Account not found" });
      var emp = typeof empRaw === "string" ? JSON.parse(empRaw) : empRaw;
      if (emp.password !== password) return res.status(401).json({ error: "Incorrect password" });
      var raw = await hgetall("jobs");
      var jobs = Object.values(raw)
        .map(function(j) { return typeof j === "string" ? JSON.parse(j) : j; })
        .filter(function(j) { return j.email === email; })
        .sort(function(a, b) { return new Date(b.submitted) - new Date(a.submitted); });
      return res.status(200).json({ success: true, employer: { name: emp.name, company: emp.company, email: emp.email, plan: emp.plan || "free" }, jobs: jobs });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // POST - edit, relist, close, or upgrade plan
  if (req.method === "POST") {
    var action = req.body.action;
    var postEmail = req.body.email;
    var postPassword = req.body.password;
    var jobId = req.body.jobId;
    var updates = req.body.updates;
    if (!postEmail || !postPassword) return res.status(400).json({ error: "Missing credentials" });

    try {
      var empRaw2 = await hget("employers", postEmail);
      if (!empRaw2) return res.status(401).json({ error: "Account not found" });
      var emp2 = typeof empRaw2 === "string" ? JSON.parse(empRaw2) : empRaw2;
      if (emp2.password !== postPassword) return res.status(401).json({ error: "Incorrect password" });

      // Upgrade plan (no jobId needed)
      if (action === "upgrade") {
        var newPlan = req.body.plan;
        var validPlans = ["free", "basic", "pro"];
        if (!newPlan || validPlans.indexOf(newPlan) === -1) return res.status(400).json({ error: "Invalid plan" });
        emp2.plan = newPlan;
        emp2.planChangedAt = new Date().toISOString();
        await hset("employers", postEmail, emp2);
        return res.status(200).json({ success: true, plan: newPlan });
      }

      // All other actions require jobId
      if (!jobId) return res.status(400).json({ error: "Missing job ID" });
      var jobRaw = await hget("jobs", jobId);
      if (!jobRaw) return res.status(404).json({ error: "Job not found" });
      var job = typeof jobRaw === "string" ? JSON.parse(jobRaw) : jobRaw;
      if (job.email !== postEmail) return res.status(403).json({ error: "Not your listing" });

      if (action === "edit") {
        if (job.status === "approved") return res.status(400).json({ error: "Cannot edit a live listing. Contact hello@findmeajob.co.nz" });
        if (!updates || typeof updates !== "object") return res.status(400).json({ error: "Missing or invalid updates" });
        var allowed = ["title", "location", "category", "type", "salary", "description", "requirements", "why"];
        allowed.forEach(function(k) { if (updates[k] !== undefined) job[k] = updates[k]; });
        job.status = "pending";
        job.editedAt = new Date().toISOString();
        job.editNote = "Resubmitted by employer after edit";
        await hset("jobs", jobId, job);
        return res.status(200).json({ success: true });
      }

      if (action === "relist") {
        if (job.status !== "approved" && job.status !== "closed") return res.status(400).json({ error: "Only expired or closed listings can be relisted" });
        var currentPlan = emp2.plan || "free";
        var planDaysMap = { free: 30, basic: 60, pro: 90 };
        job.plan = currentPlan;
        job.planDays = planDaysMap[currentPlan] || 30;
        job.approvedAt = new Date().toISOString();
        job.featured = currentPlan === "pro";
        job.priority = currentPlan === "basic" || currentPlan === "pro";
        job.status = "pending";
        job.relistedAt = new Date().toISOString();
        await hset("jobs", jobId, job);
        return res.status(200).json({ success: true });
      }

      if (action === "close") {
        job.status = "closed";
        job.closedAt = new Date().toISOString();
        await hset("jobs", jobId, job);
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: "Unknown action" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
