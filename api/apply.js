module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  var resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return res.status(500).json({ error: "Email service not configured" });

  var body = req.body;
  if (!body) return res.status(400).json({ error: "Missing request body" });

  var employerEmail = body.employerEmail;
  var jobTitle = body.jobTitle;
  var company = body.company;
  var jobId = body.jobId;
  var applicantName = body.name;
  var applicantEmail = body.email;
  var applicantPhone = body.phone || "";
  var coverLetter = body.coverLetter;
  var cvFileName = body.cvFileName;
  var cvData = body.cvData; // base64 encoded file

  if (!employerEmail || !jobTitle || !applicantName || !applicantEmail || !coverLetter) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Build email HTML
  var html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">';
  html += '<div style="background:#10b981;color:#fff;padding:1.25rem 1.5rem;border-radius:12px 12px 0 0">';
  html += '<div style="font-size:13px;font-weight:600;opacity:.85">New application via FindMeAJob.co.nz</div>';
  html += '<div style="font-size:20px;font-weight:800;margin-top:4px">Application for ' + esc(jobTitle) + '</div>';
  html += '</div>';
  html += '<div style="background:#f8f9fa;border:1px solid #e5e7eb;border-top:none;padding:1.5rem;border-radius:0 0 12px 12px">';

  // Applicant info
  html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:.5rem">Applicant</div>';
  html += '<div style="font-size:16px;font-weight:700;color:#111">' + esc(applicantName) + '</div>';
  html += '<div style="font-size:14px;color:#059669;margin-top:2px">' + esc(applicantEmail) + '</div>';
  if (applicantPhone) html += '<div style="font-size:14px;color:#6b7280;margin-top:2px">' + esc(applicantPhone) + '</div>';
  html += '</div>';

  // Cover letter
  html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:.5rem">Cover Letter</div>';
  html += '<div style="font-size:14px;line-height:1.7;color:#374151;white-space:pre-wrap">' + esc(coverLetter) + '</div>';
  html += '</div>';

  if (cvFileName) {
    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">';
    html += '<div style="font-size:13px;color:#6b7280">\ud83d\udcce Attached: <strong>' + esc(cvFileName) + '</strong></div>';
    html += '</div>';
  }

  html += '<div style="font-size:12px;color:#9ca3af;text-align:center;margin-top:1rem">Sent via <a href="https://www.findmeajob.co.nz" style="color:#059669;text-decoration:none;font-weight:600">FindMeAJob.co.nz</a></div>';
  html += '</div></div>';

  // Build Resend payload
  var emailPayload = {
    from: "FindMeAJob Applications <applications@findmeajob.co.nz>",
    to: [employerEmail],
    reply_to: applicantEmail,
    subject: "Application for " + jobTitle + " \u2014 " + applicantName,
    html: html
  };

  // Add CV attachment if provided
  if (cvData && cvFileName) {
    var base64Content = cvData;
    if (base64Content.includes("base64,")) {
      base64Content = base64Content.split("base64,")[1];
    }
    emailPayload.attachments = [{
      filename: cvFileName,
      content: base64Content
    }];
  }

  try {
    var r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + resendKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });
    var d = await r.json();
    if (r.ok) {
      // Track apply if jobId provided
      if (jobId) {
        try {
          var _kv = require("./_kv");
          var hget = _kv.hget;
          var hset = _kv.hset;
          if (_kv.getKV()) {
            var raw = await hget("jobs", jobId);
            if (raw) {
              var job = typeof raw === "string" ? JSON.parse(raw) : raw;
              job.applies = (job.applies || 0) + 1;
              await hset("jobs", jobId, job);
            }
          }
        } catch (e) { /* tracking is best-effort */ }
      }
      return res.status(200).json({ success: true });
    } else {
      return res.status(500).json({ error: d.message || "Failed to send email" });
    }
  } catch (e) {
    return res.status(500).json({ error: "Email delivery failed" });
  }
};

function esc(s) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
