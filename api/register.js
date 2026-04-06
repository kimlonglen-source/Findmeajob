var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hset = _kv.hset;
var hashPassword = _kv.hashPassword;
var verifyPassword = _kv.verifyPassword;
var isHashed = _kv.isHashed;
var validatePassword = _kv.validatePassword;

var ADMIN_EMAIL = process.env.ADMIN_EMAIL || "hello@findmeajob.co.nz";

function notifyAdmin(subject, bodyHtml) {
  var resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;
  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + resendKey },
    body: JSON.stringify({
      from: "FindMeAJob <hello@findmeajob.co.nz>",
      to: [ADMIN_EMAIL],
      subject: subject,
      html: '<div style="font-family:sans-serif;font-size:15px;line-height:1.7;color:#333">' + bodyHtml + '</div>'
    })
  }).catch(function() {});
}

var loginRateLimitMap = {};

function checkLoginRateLimit(ip) {
  var now = Date.now();
  if (!loginRateLimitMap[ip] || loginRateLimitMap[ip].resetAt < now) {
    loginRateLimitMap[ip] = { count: 1, resetAt: now + 60000 };
    return true;
  }
  loginRateLimitMap[ip].count++;
  if (loginRateLimitMap[ip].count > 10) return false;
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!getKV()) return res.status(500).json({ error: "Database not configured." });

  var action = req.body.action || "register";

  try {
    // LOGIN
    if (action === "login") {
      var loginIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "unknown";
      if (!checkLoginRateLimit(loginIp)) {
        return res.status(429).json({ error: "Too many login attempts. Please wait a minute and try again." });
      }
      var email = req.body.email;
      var password = req.body.password;
      if (!email || !password) return res.status(400).json({ error: "Missing email or password." });
      var raw = await hget("employers", email);
      if (!raw) return res.status(401).json({ error: "No account found with that email address." });
      var emp = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!verifyPassword(password, emp.password)) return res.status(401).json({ error: "Incorrect password. Please try again." });
      // Auto-upgrade plaintext password to hashed
      if (!isHashed(emp.password)) { emp.password = hashPassword(password); await hset("employers", email, emp); }
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
      var pwErr = validatePassword(regPassword);
      if (pwErr) return res.status(400).json({ error: pwErr });
      var existing = await hget("employers", regEmail);
      if (existing) return res.status(400).json({ error: "An account with this email already exists. Please sign in instead." });
      var id = "emp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      var employer = { id: id, name: name, company: company, email: regEmail, phone: phone || "", website: website || "", password: hashPassword(regPassword), plan: plan || "free", status: "active", registered: new Date().toISOString() };
      await hset("employers", regEmail, employer);
      notifyAdmin(
        "New employer registered: " + company,
        "<strong>" + (company || "") + "</strong> just registered on FindMeAJob.co.nz<br><br>"
        + "Name: " + (name || "") + "<br>"
        + "Email: " + (regEmail || "") + "<br>"
        + "Phone: " + (phone || "—") + "<br>"
        + "Plan: " + (plan || "free") + "<br>"
        + "Website: " + (website || "—") + "<br><br>"
        + '<a href="https://www.findmeajob.co.nz/admin.html" style="color:#059669;font-weight:700">Open admin panel</a>'
      );
      return res.status(200).json({ success: true, id: id, name: name, company: company, email: regEmail });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
