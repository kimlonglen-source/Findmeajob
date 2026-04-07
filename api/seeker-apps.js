var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hset = _kv.hset;
var verifyPassword = _kv.verifyPassword;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!getKV()) return res.status(500).json({ error: "Database not configured." });

  var action = req.body.action;

  try {
    // AUTH
    var email = (req.body.email || "").toLowerCase().trim();
    var password = req.body.password;
    if (!email || !password) return res.status(400).json({ error: "Email and password required." });
    var raw = await hget("seekers", email);
    if (!raw) return res.status(401).json({ error: "Account not found." });
    var sk = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!verifyPassword(password, sk.password) && !(sk.googleAuth && password === "__google__")) return res.status(401).json({ error: "Incorrect password." });

    // SAVE APPLICATION
    if (action === "save") {
      var jobId = req.body.jobId;
      var jobTitle = req.body.jobTitle;
      var company = req.body.company;
      if (!jobTitle) return res.status(400).json({ error: "Missing job details." });
      var appsRaw = await hget("applications", email);
      var apps = [];
      if (appsRaw) {
        apps = typeof appsRaw === "string" ? JSON.parse(appsRaw) : appsRaw;
        if (!Array.isArray(apps)) apps = [];
      }
      // Prevent duplicate
      var isDupe = apps.some(function(a) { return a.jobId === jobId; });
      if (!isDupe) {
        apps.unshift({
          jobId: jobId || "",
          jobTitle: jobTitle,
          company: company || "",
          appliedAt: new Date().toISOString(),
          status: "sent"
        });
        // Keep max 100 applications
        if (apps.length > 100) apps = apps.slice(0, 100);
        await hset("applications", email, apps);
      }
      return res.status(200).json({ success: true });
    }

    // LIST APPLICATIONS
    if (action === "list") {
      var listRaw = await hget("applications", email);
      var list = [];
      if (listRaw) {
        list = typeof listRaw === "string" ? JSON.parse(listRaw) : listRaw;
        if (!Array.isArray(list)) list = [];
      }
      return res.status(200).json({ success: true, applications: list });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
