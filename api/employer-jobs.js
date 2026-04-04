var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hgetall = _kv.hgetall;
var hset = _kv.hset;
var verifyPassword = _kv.verifyPassword;
var isHashed = _kv.isHashed;
var hashPassword = _kv.hashPassword;

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
      if (!verifyPassword(password, emp.password)) return res.status(401).json({ error: "Incorrect password" });
      if (!isHashed(emp.password)) { emp.password = hashPassword(password); await hset("employers", email, emp); }
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
      if (!verifyPassword(postPassword, emp2.password)) return res.status(401).json({ error: "Incorrect password" });
      if (!isHashed(emp2.password)) { emp2.password = hashPassword(postPassword); await hset("employers", postEmail, emp2); }

      // List employer jobs (same as GET but via POST)
      if (action === "list") {
        var allRaw = await hgetall("jobs");
        var allJobs2 = Object.values(allRaw)
          .map(function(j) { return typeof j === "string" ? JSON.parse(j) : j; })
          .filter(function(j) { return j.email === postEmail; })
          .sort(function(a, b) { return new Date(b.submitted) - new Date(a.submitted); });
        return res.status(200).json({ success: true, employer: { name: emp2.name, company: emp2.company, email: emp2.email, plan: emp2.plan || "free" }, jobs: allJobs2 });
      }

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

      // Submit new job listing
      if (action === "submit") {
        var LAUNCH_END = new Date("2026-10-01T00:00:00Z");
        var isLaunchPeriod = new Date() < LAUNCH_END;
        var PLAN_LIMITS = { free: 1, basic: 5, pro: 999 };
        var PLAN_DAYS = { free: 90, basic: 90, pro: 90 }; // All plans get 90 days during launch
        var planKey = emp2.plan || "free";
        var sTitle = req.body.title;
        var sDesc = req.body.description;
        if (!sTitle || !sDesc) return res.status(400).json({ error: "Missing job title or description" });
        // During launch: unlimited for all plans
        if (!isLaunchPeriod) {
          var limit = PLAN_LIMITS[planKey] || 1;
          if (limit < 999) {
            var allJobs = await hgetall("jobs");
            var active = Object.values(allJobs).map(function(j){return typeof j==="string"?JSON.parse(j):j;}).filter(function(j){return j.email===postEmail&&(j.status==="approved"||j.status==="pending");});
            if (active.length >= limit) {
              var planNames = {free:"Starter",basic:"Growth",pro:"Pro"};
              return res.status(400).json({error:"Your "+(planNames[planKey]||planKey)+" plan allows "+limit+" active listing"+(limit>1?"s":"")+". You have "+active.length+" active. Upgrade your plan to post more.",limitReached:true});
            }
          }
        }
        var jid = "job_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
        var newJob = {
          id: jid, employerId: req.body.employerId || "", company: emp2.company || req.body.company, email: postEmail,
          title: sTitle, location: req.body.location || "New Zealand", category: req.body.category || "Other",
          type: req.body.type || "Full-time", salary: req.body.salary || "Negotiable",
          description: sDesc, requirements: req.body.requirements || "", why: req.body.why || "",
          companyProfile: (planKey === "basic" || planKey === "pro") ? (req.body.companyProfile || "") : "", website: req.body.website || "", logoUrl: (planKey === "basic" || planKey === "pro") ? (req.body.logoUrl || "") : "",
          plan: planKey, planDays: PLAN_DAYS[planKey] || 30,
          autoFeature: planKey === "pro", priority: planKey === "basic" || planKey === "pro",
          status: "pending", submitted: new Date().toISOString(), views: 0, applies: 0
        };
        await hset("jobs", jid, newJob);
        return res.status(200).json({ success: true, id: jid });
      }

      // All other actions require jobId
      if (!jobId) return res.status(400).json({ error: "Missing job ID" });
      var jobRaw = await hget("jobs", jobId);
      if (!jobRaw) return res.status(404).json({ error: "Job not found" });
      var job = typeof jobRaw === "string" ? JSON.parse(jobRaw) : jobRaw;
      if (job.email !== postEmail) return res.status(403).json({ error: "Not your listing" });

      if (action === "edit") {
        if (!updates || typeof updates !== "object") return res.status(400).json({ error: "Missing or invalid updates" });
        var allowed = ["title", "location", "category", "type", "salary", "description", "requirements", "why"];
        var empPlan = emp2.plan || "free";
        if (empPlan === "basic" || empPlan === "pro") {
          allowed.push("companyProfile", "logoUrl");
        }
        allowed.forEach(function(k) { if (updates[k] !== undefined) job[k] = updates[k]; });
        job.editedAt = new Date().toISOString();
        if (job.status !== "approved") {
          job.status = "pending";
          job.editNote = "Resubmitted by employer after edit";
        }
        await hset("jobs", jobId, job);
        return res.status(200).json({ success: true });
      }

      if (action === "relist") {
        if (job.status !== "approved" && job.status !== "closed") return res.status(400).json({ error: "Only expired or closed listings can be relisted" });
        var currentPlan = emp2.plan || "free";
        var LAUNCH_END_R = new Date("2026-10-01T00:00:00Z");
        var planDaysMap = { free: 30, basic: 60, pro: 90 };
        job.plan = currentPlan;
        job.planDays = (new Date() < LAUNCH_END_R) ? 90 : (planDaysMap[currentPlan] || 30);
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

      // DELETE EMPLOYER ACCOUNT
      if (action === "delete-account") {
        var hdel = _kv.hdel;
        // Delete all their jobs
        var allJobsDel = await hgetall("jobs");
        var empJobs = Object.entries(allJobsDel).filter(function(e) { var j = typeof e[1] === "string" ? JSON.parse(e[1]) : e[1]; return j.email === postEmail; });
        for (var d = 0; d < empJobs.length; d++) { await hdel("jobs", empJobs[d][0]); }
        // Delete employer record
        await hdel("employers", postEmail);
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: "Unknown action" });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
};
