var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hset = _kv.hset;
var hdel = _kv.hdel;
var hashPassword = _kv.hashPassword;
var verifyPassword = _kv.verifyPassword;
var isHashed = _kv.isHashed;
var validatePassword = _kv.validatePassword;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!getKV()) return res.status(500).json({ error: "Database not configured." });

  var action = req.body.action;

  try {
    // REGISTER
    if (action === "register") {
      var name = req.body.name;
      var email = (req.body.email || "").toLowerCase().trim();
      var password = req.body.password;
      if (!name || !email || !password) return res.status(400).json({ error: "Name, email and password are required." });
      var pwErr = validatePassword(password);
      if (pwErr) return res.status(400).json({ error: pwErr });
      var existing = await hget("seekers", email);
      if (existing) return res.status(400).json({ error: "An account with this email already exists. Please sign in." });
      var id = "sk_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      var seeker = {
        id: id, name: name, email: email, password: hashPassword(password),
        phone: req.body.phone || "", rtw: req.body.rtw || "", notice: req.body.notice || "",
        cvText: null, cvFileName: null,
        createdAt: new Date().toISOString()
      };
      await hset("seekers", email, seeker);
      return res.status(200).json({ success: true, seeker: { id: id, name: name, email: email, phone: seeker.phone, rtw: seeker.rtw, notice: seeker.notice, hasCv: false } });
    }

    // LOGIN
    if (action === "login") {
      var loginEmail = (req.body.email || "").toLowerCase().trim();
      var loginPass = req.body.password;
      if (!loginEmail || !loginPass) return res.status(400).json({ error: "Email and password required." });
      var raw = await hget("seekers", loginEmail);
      if (!raw) return res.status(401).json({ error: "No account found. Please register first." });
      var sk = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (sk.password !== loginPass) return res.status(401).json({ error: "Incorrect password." });
      return res.status(200).json({ success: true, seeker: { id: sk.id, name: sk.name, email: sk.email, phone: sk.phone || "", rtw: sk.rtw || "", notice: sk.notice || "", hasCv: !!(sk.cvText || sk.cvFileName) } });
    }

    // UPDATE PROFILE
    if (action === "update") {
      var authResult = await authSeeker(req.body.email, req.body.password);
      if (authResult.error) return res.status(authResult.status).json({ error: authResult.error });
      var sk2 = authResult.seeker;
      if (req.body.name !== undefined) sk2.name = req.body.name;
      if (req.body.phone !== undefined) sk2.phone = req.body.phone;
      if (req.body.rtw !== undefined) sk2.rtw = req.body.rtw;
      if (req.body.notice !== undefined) sk2.notice = req.body.notice;
      sk2.updatedAt = new Date().toISOString();
      await hset("seekers", sk2.email, sk2);
      return res.status(200).json({ success: true });
    }

    // SAVE CV
    if (action === "save-cv") {
      var authResult2 = await authSeeker(req.body.email, req.body.password);
      if (authResult2.error) return res.status(authResult2.status).json({ error: authResult2.error });
      var sk3 = authResult2.seeker;
      sk3.cvText = req.body.cvText || null;
      sk3.cvFileName = req.body.cvFileName || null;
      sk3.cvSavedAt = new Date().toISOString();
      await hset("seekers", sk3.email, sk3);
      return res.status(200).json({ success: true });
    }

    // DELETE CV
    if (action === "delete-cv") {
      var authResult3 = await authSeeker(req.body.email, req.body.password);
      if (authResult3.error) return res.status(authResult3.status).json({ error: authResult3.error });
      var sk4 = authResult3.seeker;
      sk4.cvText = null;
      sk4.cvFileName = null;
      sk4.cvSavedAt = null;
      await hset("seekers", sk4.email, sk4);
      return res.status(200).json({ success: true });
    }

    // DELETE ACCOUNT
    if (action === "delete-account") {
      var authResult4 = await authSeeker(req.body.email, req.body.password);
      if (authResult4.error) return res.status(authResult4.status).json({ error: authResult4.error });
      await hdel("seekers", (req.body.email || "").toLowerCase().trim());
      // Also delete their applications
      var appsRaw = await hget("applications", (req.body.email || "").toLowerCase().trim());
      if (appsRaw) await hdel("applications", (req.body.email || "").toLowerCase().trim());
      return res.status(200).json({ success: true });
    }

    // GET PROFILE (with saved CV status)
    if (action === "profile") {
      var authResult5 = await authSeeker(req.body.email, req.body.password);
      if (authResult5.error) return res.status(authResult5.status).json({ error: authResult5.error });
      var sk5 = authResult5.seeker;
      return res.status(200).json({ success: true, seeker: { id: sk5.id, name: sk5.name, email: sk5.email, phone: sk5.phone || "", rtw: sk5.rtw || "", notice: sk5.notice || "", hasCv: !!(sk5.cvText || sk5.cvFileName), cvFileName: sk5.cvFileName || null } });
    }

    // GET CV TEXT (for auto-fill in apply form)
    if (action === "get-cv") {
      var authResult6 = await authSeeker(req.body.email, req.body.password);
      if (authResult6.error) return res.status(authResult6.status).json({ error: authResult6.error });
      var sk6 = authResult6.seeker;
      return res.status(200).json({ success: true, cvText: sk6.cvText || "", cvFileName: sk6.cvFileName || "" });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

async function authSeeker(email, password) {
  if (!email || !password) return { status: 400, error: "Email and password required." };
  var raw = await hget("seekers", (email || "").toLowerCase().trim());
  if (!raw) return { status: 401, error: "Account not found." };
  var sk = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!verifyPassword(password, sk.password)) return { status: 401, error: "Incorrect password." };
  // Auto-upgrade plaintext password to hashed
  if (!isHashed(sk.password)) {
    sk.password = hashPassword(password);
    await hset("seekers", sk.email, sk);
  }
  return { seeker: sk };
}
