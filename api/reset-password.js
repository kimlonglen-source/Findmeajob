var crypto = require("crypto");
var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hset = _kv.hset;

async function sendResetEmail(toEmail, toName, resetUrl) {
  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false };
  }
  var html = ""
    + '<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#0a0a08;color:#f2efe8;border-radius:12px">'
    + '<div style="margin-bottom:1.5rem">'
    + '<span style="background:#10b981;color:#fff;font-size:1rem;font-weight:800;padding:.4rem .9rem;border-radius:6px">FindMeAJob.co.nz</span>'
    + "</div>"
    + '<h1 style="font-size:1.4rem;font-weight:700;color:#f2efe8;margin-bottom:.5rem">Reset your password</h1>'
    + '<p style="color:#c8c4bc;font-size:.95rem;line-height:1.6;margin-bottom:1.5rem">Hi ' + (toName || "there") + ",<br><br>We received a request to reset your FindMeAJob employer account password. Click the button below to set a new password.</p>"
    + '<a href="' + resetUrl + '" style="display:inline-block;background:#10b981;color:#fff;padding:.85rem 1.8rem;border-radius:8px;text-decoration:none;font-weight:800;font-size:.95rem;margin-bottom:1.5rem">Reset My Password &rarr;</a>'
    + '<p style="color:#888480;font-size:.8rem;line-height:1.6;margin-bottom:.5rem">This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>'
    + '<p style="color:#888480;font-size:.8rem">Or copy this link: <span style="color:#10b981">' + resetUrl + "</span></p>"
    + '<hr style="border:none;border-top:1px solid #2a2a28;margin:1.5rem 0">'
    + '<p style="color:#888480;font-size:.75rem">FindMeAJob.co.nz &mdash; AI-powered job discovery for Aotearoa New Zealand</p>'
    + "</div>";
  var r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "FindMeAJob <noreply@findmeajob.co.nz>",
      to: [toEmail],
      subject: "Reset your FindMeAJob password",
      html: html
    })
  });
  return { sent: r.ok, status: r.status };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!getKV()) return res.status(500).json({ error: "Database not configured." });
  try {
    var email = req.body.email;
    var token = req.body.token;
    var newPassword = req.body.newPassword;

    // Step 1: Request reset - generate token and send email
    if (email && !token && !newPassword) {
      var raw = await hget("employers", email);
      if (!raw) return res.status(404).json({ error: "No account found with that email address." });
      var emp = typeof raw === "string" ? JSON.parse(raw) : raw;
      var resetToken = crypto.randomBytes(32).toString("hex");
      var resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      emp.resetToken = resetToken;
      emp.resetExpiry = resetExpiry;
      await hset("employers", email, emp);
      var resetUrl = "https://www.findmeajob.co.nz/employer-portal.html?reset=" + resetToken + "&email=" + encodeURIComponent(email);
      var emailResult = await sendResetEmail(email, emp.name, resetUrl);
      if (emailResult.sent) {
        return res.status(200).json({ success: true, method: "email" });
      } else {
        // Email service not configured or failed - do not expose token
        return res.status(200).json({ success: true, message: "If that email exists in our system, a reset link has been sent. If you do not receive it, please try again or contact hello@findmeajob.co.nz" });
      }
    }

    // Step 2: Complete reset with token
    if (token && newPassword && email) {
      var pwErr = _kv.validatePassword(newPassword);
      if (pwErr) return res.status(400).json({ error: pwErr });
      var raw2 = await hget("employers", email);
      if (!raw2) return res.status(404).json({ error: "Invalid reset link." });
      var emp2 = typeof raw2 === "string" ? JSON.parse(raw2) : raw2;
      if (emp2.resetToken !== token) return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      if (new Date(emp2.resetExpiry) < new Date()) return res.status(400).json({ error: "This reset link has expired. Please request a new one." });
      emp2.password = _kv.hashPassword(newPassword);
      delete emp2.resetToken;
      delete emp2.resetExpiry;
      emp2.passwordChanged = new Date().toISOString();
      await hset("employers", email, emp2);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Missing required fields." });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
