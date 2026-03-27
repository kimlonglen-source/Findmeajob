var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hset = _kv.hset;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!getKV()) return res.status(500).json({ error: "Database not configured." });

  var action = req.body.action || "register";

  try {
    // LOGIN
    if (action === "login") {
      var email = req.body.email;
      var password = req.body.password;
      if (!email || !password) return res.status(400).json({ error: "Missing email or password." });
      var raw = await hget("employers", email);
      if (!raw) return res.status(401).json({ error: "No account found with that email address." });
      var emp = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (emp.password !== password) return res.status(401).json({ error: "Incorrect password. Please try again." });
      return res.status(200).json({ success: true, id: emp.id, name: emp.name, company: emp.company, email: emp.email, plan: emp.plan || "free" });
    }

    // REGISTER
    if (action === "register") {
      var name = req.body.name;
      var company = req.body.company;
      var regEmail = req.body.email;
      var regPassword = req.body.password;
      var phone = req.body.phone;
      var website = req.body.website;
      var plan = req.body.plan;
      if (!name || !company || !regEmail || !regPassword) return res.status(400).json({ error: "Missing required fields" });
      var existing = await hget("employers", regEmail);
      if (existing) return res.status(400).json({ error: "An account with this email already exists. Please sign in instead." });
      var id = "emp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      var employer = { id: id, name: name, company: company, email: regEmail, phone: phone || "", website: website || "", password: regPassword, plan: plan || "free", status: "active", registered: new Date().toISOString() };
      await hset("employers", regEmail, employer);
      return res.status(200).json({ success: true, id: id, name: name, company: company, email: regEmail });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
