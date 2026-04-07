var crypto = require("crypto");
var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hset = _kv.hset;
var hdel = _kv.hdel;
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
  // Allow GET for unsubscribe links
  if (req.method === "GET" && req.query.action === "unsubscribe") {
    if (!getKV()) return res.status(200).send("<html><body>Unsubscribed</body></html>");
    var unsubEmail = (req.query.email || "").toLowerCase().trim();
    if (unsubEmail) {
      var rawU = await hget("seekers", unsubEmail);
      if (rawU) { var skU = typeof rawU === "string" ? JSON.parse(rawU) : rawU; skU.emailAlerts = false; skU.emailUpdates = false; await hset("seekers", unsubEmail, skU); }
    }
    return res.status(200).send("<html><body style='font-family:Arial,sans-serif;text-align:center;padding:3rem;background:#09090b;color:#f8fafc'><div style='max-width:400px;margin:0 auto'><div style='font-size:2rem;margin-bottom:1rem'>&#10003;</div><h2 style='color:#10b981'>Unsubscribed</h2><p style='color:#94a3b8'>You have been unsubscribed from all FindMeAJob.co.nz emails. You can re-enable them anytime from your account.</p><a href='https://www.findmeajob.co.nz' style='color:#10b981'>Back to FindMeAJob.co.nz</a></div></body></html>");
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!getKV()) return res.status(500).json({ error: "Database not configured." });

  var action = req.body.action;

  try {
    // Return Google Client ID to frontend
    if (action === "google-client-id") {
      var gClientId = process.env.GOOGLE_CLIENT_ID || "";
      return res.status(200).json({ clientId: gClientId });
    }

    // GOOGLE SIGN-IN
    if (action === "google-login") {
      var credential = req.body.credential;
      if (!credential) return res.status(400).json({ error: "Missing credential" });
      // Decode the JWT payload (Google ID token)
      var parts = credential.split(".");
      if (parts.length !== 3) return res.status(400).json({ error: "Invalid credential" });
      var payload;
      try {
        var b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        payload = JSON.parse(Buffer.from(b64, "base64").toString());
      } catch (e) {
        return res.status(400).json({ error: "Invalid credential" });
      }
      // Verify issuer and audience
      var gClientId2 = process.env.GOOGLE_CLIENT_ID;
      if (!gClientId2) return res.status(500).json({ error: "Google sign-in not configured" });
      if (payload.iss !== "accounts.google.com" && payload.iss !== "https://accounts.google.com") return res.status(400).json({ error: "Invalid token issuer" });
      if (payload.aud !== gClientId2) return res.status(400).json({ error: "Invalid token audience" });
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return res.status(400).json({ error: "Token expired" });
      if (!payload.email || !payload.email_verified) return res.status(400).json({ error: "Email not verified" });

      var gEmail = payload.email.toLowerCase().trim();
      var gName = payload.name || gEmail.split("@")[0];

      // Check if seeker exists
      var gExisting = await hget("seekers", gEmail);
      if (gExisting) {
        // Existing user — log them in
        var gSeeker = typeof gExisting === "string" ? JSON.parse(gExisting) : gExisting;
        return res.status(200).json({ success: true, seeker: { id: gSeeker.id, name: gSeeker.name, firstName: gSeeker.firstName || "", middleName: gSeeker.middleName || "", lastName: gSeeker.lastName || "", email: gSeeker.email, phone: gSeeker.phone || "", location: gSeeker.location || "", rtw: gSeeker.rtw || "", notice: gSeeker.notice || "", hasCv: !!(gSeeker.cvText || gSeeker.cvFileName) } });
      }

      // New user — create account
      var gId = "sk_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      var gNewSeeker = {
        id: gId, name: gName, firstName: payload.given_name || gName.split(" ")[0] || "", middleName: "", lastName: payload.family_name || gName.split(" ").slice(1).join(" ") || "",
        email: gEmail, password: "__google_oauth__",
        phone: "", location: "", rtw: "", notice: "",
        emailAlerts: true, emailUpdates: false,
        cvText: null, cvFileName: null,
        createdAt: new Date().toISOString(),
        googleAuth: true
      };
      await hset("seekers", gEmail, gNewSeeker);
      notifyAdmin(
        "New job seeker registered (Google): " + gName,
        "A new job seeker signed up with Google:<br><br>"
        + "Name: " + gName + "<br>"
        + "Email: " + gEmail + "<br><br>"
        + '<a href="https://www.findmeajob.co.nz/admin.html" style="color:#059669;font-weight:700">Open admin panel</a>'
      );
      return res.status(200).json({ success: true, seeker: { id: gId, name: gName, firstName: gNewSeeker.firstName || "", middleName: "", lastName: gNewSeeker.lastName || "", email: gEmail, phone: "", location: "", rtw: "", notice: "", hasCv: false } });
    }

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
        id: id, name: name, firstName: req.body.firstName || "", middleName: req.body.middleName || "", lastName: req.body.lastName || "",
        email: email, password: hashPassword(password),
        phone: req.body.phone || "", location: req.body.location || "", rtw: req.body.rtw || "", notice: req.body.notice || "",
        emailAlerts: !!req.body.emailAlerts, emailUpdates: !!req.body.emailUpdates,
        cvText: null, cvFileName: null,
        createdAt: new Date().toISOString()
      };
      await hset("seekers", email, seeker);
      notifyAdmin(
        "New job seeker registered: " + name,
        "A new job seeker just created an account:<br><br>"
        + "Name: " + (name || "") + "<br>"
        + "Email: " + (email || "") + "<br>"
        + "Right to work: " + (seeker.rtw || "—") + "<br>"
        + "Email alerts: " + (seeker.emailAlerts ? "Yes" : "No") + "<br><br>"
        + '<a href="https://www.findmeajob.co.nz/admin.html" style="color:#059669;font-weight:700">Open admin panel</a>'
      );
      return res.status(200).json({ success: true, seeker: { id: id, name: name, firstName: seeker.firstName || "", middleName: seeker.middleName || "", lastName: seeker.lastName || "", email: email, phone: seeker.phone, location: seeker.location || "", rtw: seeker.rtw, notice: seeker.notice, hasCv: false } });
    }

    // LOGIN
    if (action === "login") {
      var loginIp = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "unknown";
      if (!checkLoginRateLimit(loginIp)) {
        return res.status(429).json({ error: "Too many login attempts. Please wait a minute and try again." });
      }
      var loginEmail = (req.body.email || "").toLowerCase().trim();
      var loginPass = req.body.password;
      if (!loginEmail || !loginPass) return res.status(400).json({ error: "Email and password required." });
      var raw = await hget("seekers", loginEmail);
      if (!raw) return res.status(401).json({ error: "No account found. Please register first." });
      var sk = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!verifyPassword(loginPass, sk.password)) return res.status(401).json({ error: "Incorrect password." });
      // Auto-upgrade plaintext password to hashed
      if (!isHashed(sk.password)) { sk.password = hashPassword(loginPass); await hset("seekers", loginEmail, sk); }
      return res.status(200).json({ success: true, seeker: { id: sk.id, name: sk.name, firstName: sk.firstName || "", middleName: sk.middleName || "", lastName: sk.lastName || "", email: sk.email, phone: sk.phone || "", location: sk.location || "", rtw: sk.rtw || "", notice: sk.notice || "", hasCv: !!(sk.cvText || sk.cvFileName) } });
    }

    // UPDATE PROFILE
    if (action === "update") {
      var authResult = await authSeeker(req.body.email, req.body.password);
      if (authResult.error) return res.status(authResult.status).json({ error: authResult.error });
      var sk2 = authResult.seeker;
      if (req.body.name !== undefined) sk2.name = req.body.name;
      if (req.body.firstName !== undefined) sk2.firstName = req.body.firstName;
      if (req.body.middleName !== undefined) sk2.middleName = req.body.middleName;
      if (req.body.lastName !== undefined) sk2.lastName = req.body.lastName;
      if (req.body.phone !== undefined) sk2.phone = req.body.phone;
      if (req.body.location !== undefined) sk2.location = req.body.location;
      if (req.body.rtw !== undefined) sk2.rtw = req.body.rtw;
      if (req.body.notice !== undefined) sk2.notice = req.body.notice;
      if (req.body.emailAlerts !== undefined) sk2.emailAlerts = !!req.body.emailAlerts;
      if (req.body.emailUpdates !== undefined) sk2.emailUpdates = !!req.body.emailUpdates;
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
      return res.status(200).json({ success: true, seeker: { id: sk5.id, name: sk5.name, firstName: sk5.firstName || "", middleName: sk5.middleName || "", lastName: sk5.lastName || "", email: sk5.email, phone: sk5.phone || "", location: sk5.location || "", rtw: sk5.rtw || "", notice: sk5.notice || "", hasCv: !!(sk5.cvText || sk5.cvFileName), cvFileName: sk5.cvFileName || null, emailAlerts: !!sk5.emailAlerts, emailUpdates: !!sk5.emailUpdates } });
    }

    // GET CV TEXT (for auto-fill in apply form)
    if (action === "get-cv") {
      var authResult6 = await authSeeker(req.body.email, req.body.password);
      if (authResult6.error) return res.status(authResult6.status).json({ error: authResult6.error });
      var sk6 = authResult6.seeker;
      return res.status(200).json({ success: true, cvText: sk6.cvText || "", cvFileName: sk6.cvFileName || "" });
    }

    // PASSWORD RESET REQUEST (no auth needed)
    if (action === "reset-request") {
      var resetEmail = (req.body.email || "").toLowerCase().trim();
      if (!resetEmail) return res.status(400).json({ error: "Email required." });
      var rawReset = await hget("seekers", resetEmail);
      if (!rawReset) return res.status(404).json({ error: "No account found with that email." });
      var skReset = typeof rawReset === "string" ? JSON.parse(rawReset) : rawReset;
      var resetToken = crypto.randomBytes(32).toString("hex");
      skReset.resetToken = resetToken;
      skReset.resetExpiry = new Date(Date.now() + 3600000).toISOString();
      await hset("seekers", resetEmail, skReset);
      var resetUrl = "https://www.findmeajob.co.nz/?seeker-reset=" + resetToken + "&email=" + encodeURIComponent(resetEmail);
      var resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": "Bearer " + resendKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "FindMeAJob <noreply@findmeajob.co.nz>",
              to: [resetEmail],
              subject: "Reset your FindMeAJob password",
              html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto"><div style="background:#10b981;color:#fff;padding:1.25rem;border-radius:12px 12px 0 0;text-align:center"><div style="font-size:18px;font-weight:800">Password Reset</div></div><div style="background:#f8f9fa;border:1px solid #e5e7eb;border-top:none;padding:1.5rem;border-radius:0 0 12px 12px"><p style="font-size:14px;color:#374151;line-height:1.7">You requested a password reset for your FindMeAJob.co.nz account.</p><div style="text-align:center;margin:1.5rem 0"><a href="' + resetUrl + '" style="display:inline-block;background:#10b981;color:#fff;padding:12px 28px;border-radius:25px;font-size:14px;font-weight:700;text-decoration:none">Reset My Password</a></div><p style="font-size:12px;color:#9ca3af">This link expires in 1 hour. If you did not request this, you can ignore this email.</p></div></div>'
            })
          });
          return res.status(200).json({ success: true, method: "email" });
        } catch (e) { return res.status(200).json({ success: true, method: "email" }); }
      }
      return res.status(200).json({ success: true, method: "email" });
    }

    // COMPLETE PASSWORD RESET (no auth, uses token)
    if (action === "reset-complete") {
      var rcEmail = (req.body.email || "").toLowerCase().trim();
      var rcToken = req.body.token;
      var rcNewPass = req.body.newPassword;
      if (!rcEmail || !rcToken || !rcNewPass) return res.status(400).json({ error: "Missing fields." });
      var pwErr = validatePassword(rcNewPass);
      if (pwErr) return res.status(400).json({ error: pwErr });
      var rawRc = await hget("seekers", rcEmail);
      if (!rawRc) return res.status(404).json({ error: "Account not found." });
      var skRc = typeof rawRc === "string" ? JSON.parse(rawRc) : rawRc;
      if (skRc.resetToken !== rcToken) return res.status(400).json({ error: "Invalid or expired reset link." });
      if (new Date(skRc.resetExpiry) < new Date()) return res.status(400).json({ error: "Reset link has expired. Please request a new one." });
      skRc.password = hashPassword(rcNewPass);
      delete skRc.resetToken;
      delete skRc.resetExpiry;
      await hset("seekers", rcEmail, skRc);
      return res.status(200).json({ success: true });
    }

    // ONE-CLICK UNSUBSCRIBE (no auth needed, uses email + token)
    if (action === "unsubscribe") {
      var unsubEmail = (req.body.email || req.query.email || "").toLowerCase().trim();
      var unsubToken = req.body.token || req.query.token || "";
      if (!unsubEmail) return res.status(400).json({ error: "Missing email" });
      var rawUnsub = await hget("seekers", unsubEmail);
      if (!rawUnsub) {
        // Return HTML page for GET requests
        if (req.method === "GET") return res.status(200).send("<html><body style='font-family:Arial;text-align:center;padding:3rem'><h2>Unsubscribed</h2><p>You have been unsubscribed from job alerts.</p></body></html>");
        return res.status(200).json({ success: true });
      }
      var skUnsub = typeof rawUnsub === "string" ? JSON.parse(rawUnsub) : rawUnsub;
      skUnsub.emailAlerts = false;
      skUnsub.emailUpdates = false;
      await hset("seekers", unsubEmail, skUnsub);
      if (req.method === "GET") return res.status(200).send("<html><body style='font-family:Arial,sans-serif;text-align:center;padding:3rem;background:#09090b;color:#f8fafc'><div style='max-width:400px;margin:0 auto'><div style='font-size:2rem;margin-bottom:1rem'>&#10003;</div><h2 style='color:#10b981'>Unsubscribed</h2><p style='color:#94a3b8'>You have been unsubscribed from all FindMeAJob.co.nz emails. You can re-enable them anytime from your account.</p><a href='https://www.findmeajob.co.nz' style='color:#10b981'>Back to FindMeAJob.co.nz</a></div></body></html>");
      return res.status(200).json({ success: true });
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
  // Allow Google OAuth users to authenticate with __google__ token
  if (sk.googleAuth && password === "__google__") { return { seeker: sk }; }
  if (!verifyPassword(password, sk.password)) return { status: 401, error: "Incorrect password." };
  // Auto-upgrade plaintext password to hashed
  if (!isHashed(sk.password)) {
    sk.password = hashPassword(password);
    await hset("seekers", sk.email, sk);
  }
  return { seeker: sk };
}
