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
  var jobRef = body.jobRef || "";
  var applicantName = body.name;
  var applicantEmail = body.email;
  var applicantPhone = body.phone || "";
  var rightToWork = body.rightToWork || "";
  var noticePeriod = body.noticePeriod || "";
  var coverLetter = body.coverLetter;
  var cvFileName = body.cvFileName;
  var cvData = body.cvData; // base64 encoded file

  if (!employerEmail || !jobTitle || !applicantName || !applicantEmail || !coverLetter) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  var appliedDate = new Date().toLocaleDateString("en-NZ", {day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"});

  // Build email HTML
  var html = '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">';
  html += '<div style="background:#10b981;color:#fff;padding:1.25rem 1.5rem;border-radius:12px 12px 0 0">';
  html += '<div style="font-size:13px;font-weight:600;opacity:.85">New application via FindMeAJob.co.nz</div>';
  html += '<div style="font-size:20px;font-weight:800;margin-top:4px">Application for ' + esc(jobTitle) + '</div>';
  if (jobRef) html += '<div style="font-size:12px;color:#9ca3af;margin-top:2px">Reference: ' + esc(jobRef) + '</div>';
  html += '</div>';
  html += '<div style="background:#f8f9fa;border:1px solid #e5e7eb;border-top:none;padding:1.5rem;border-radius:0 0 12px 12px">';

  // Applicant info
  html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:.5rem">Applicant Details</div>';
  html += '<table style="width:100%;font-size:14px;border-collapse:collapse">';
  html += '<tr><td style="padding:4px 8px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">Name</td><td style="padding:4px 0;font-weight:700;color:#111">' + esc(applicantName) + '</td></tr>';
  html += '<tr><td style="padding:4px 8px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">Email</td><td style="padding:4px 0"><a href="mailto:' + esc(applicantEmail) + '" style="color:#059669;text-decoration:none;font-weight:600">' + esc(applicantEmail) + '</a></td></tr>';
  if (applicantPhone) html += '<tr><td style="padding:4px 8px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">Phone</td><td style="padding:4px 0;font-weight:600">' + esc(applicantPhone) + '</td></tr>';
  if (rightToWork) html += '<tr><td style="padding:4px 8px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">Right to work</td><td style="padding:4px 0">' + esc(rightToWork) + '</td></tr>';
  if (noticePeriod) html += '<tr><td style="padding:4px 8px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">Notice period</td><td style="padding:4px 0">' + esc(noticePeriod) + '</td></tr>';
  html += '<tr><td style="padding:4px 8px 4px 0;color:#6b7280;white-space:nowrap;vertical-align:top">Applied</td><td style="padding:4px 0;color:#6b7280">' + appliedDate + '</td></tr>';
  html += '</table></div>';

  // Cover letter
  html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">';
  html += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:.5rem">Cover Letter</div>';
  html += '<div style="font-size:14px;line-height:1.7;color:#374151;white-space:pre-wrap">' + esc(coverLetter) + '</div>';
  html += '</div>';

  var cvContent = req.body.cvContent || "";
  var isRealAttachment = cvFileName && !cvFileName.endsWith('.html');
  if (isRealAttachment) {
    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem;margin-bottom:1rem">';
    html += '<div style="font-size:13px;color:#6b7280">\ud83d\udcce Attached: <strong>' + esc(cvFileName) + '</strong></div>';
    html += '</div>';
  }

  // If tailored CV content provided, include it inline in the email
  if (cvContent) {
    html += '<div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1.5rem;margin-bottom:1rem">';
    // Check if CV content starts with the candidate name — if not, add header
    var cvFirstLine = (cvContent.split('\n')[0] || '').trim().toUpperCase();
    var nameInCv = cvFirstLine.indexOf((applicantName || '').toUpperCase()) !== -1;
    if (!nameInCv) {
      html += '<div style="border-bottom:2px solid #1a1a1a;padding-bottom:8px;margin-bottom:14px">';
      html += '<div style="font-size:18px;font-weight:700;color:#1a1a1a">' + esc(applicantName) + '</div>';
      html += '<div style="font-size:12px;color:#555;margin-top:2px">' + esc(applicantEmail);
      if (applicantPhone) html += ' &nbsp;|&nbsp; ' + esc(applicantPhone);
      if (rightToWork) html += ' &nbsp;|&nbsp; ' + esc(rightToWork);
      html += '</div></div>';
    }
    var cvLines = cvContent.split('\n');
    var sectionRe = /^(PROFILE|PROFESSIONAL PROFILE|KEY SKILLS|KEY SKILLS AND EXPERIENCE|EXPERIENCE|PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EDUCATION|EDUCATION & QUALIFICATIONS|EDUCATION AND TRAINING|REFERENCES|PROFESSIONAL SUMMARY|RELEVANT SKILLS|QUALIFICATIONS|CERTIFICATIONS|SKILLS|CAREER SUMMARY|WORK HISTORY|EMPLOYMENT HISTORY|KEY ACHIEVEMENTS)$/i;
    for (var ci = 0; ci < cvLines.length; ci++) {
      var cl = cvLines[ci].trim();
      if (!cl) continue;
      if (sectionRe.test(cl)) { html += '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#1a1a1a;border-bottom:1px solid #ddd;padding-bottom:3px;margin:18px 0 8px">' + esc(cl) + '</div>'; }
      else if (cl.match(/^[-•●]/)) { html += '<div style="font-size:13px;color:#374151;line-height:1.65;padding-left:16px;margin-bottom:4px">&bull; ' + esc(cl.replace(/^[-•●]\s*/, '')) + '</div>'; }
      else if (cl.match(/^(.+)\s[—–-]\s(.+)\s\d{4}/) || cl.match(/^(.+)\s[—–-]\s(.+),/) || cl.match(/^(.+)\s[—–-]\s(.+)\s*\(/)) { html += '<div style="font-size:13px;font-weight:700;color:#1a1a1a;margin:12px 0 4px">' + esc(cl) + '</div>'; }
      else { html += '<div style="font-size:13px;color:#374151;line-height:1.65;margin-bottom:4px">' + esc(cl) + '</div>'; }
    }
    html += '</div>';
  }

  html += '<div style="font-size:12px;color:#9ca3af;text-align:center;margin-top:1rem">Sent via <a href="https://www.findmeajob.co.nz" style="color:#059669;text-decoration:none;font-weight:600">FindMeAJob.co.nz</a></div>';
  html += '</div></div>';

  // Build Resend payload
  var emailPayload = {
    from: "FindMeAJob Applications <applications@findmeajob.co.nz>",
    to: [employerEmail],
    reply_to: applicantEmail,
    subject: "Application for " + jobTitle + (jobRef ? " [" + jobRef + "]" : "") + " \u2014 " + applicantName,
    html: html
  };

  // Add cover letter file attachment if provided
  var clFileName = body.coverLetterFileName;
  var clData = body.coverLetterData;
  if (clData && clFileName) {
    if (!emailPayload.attachments) emailPayload.attachments = [];
    emailPayload.attachments.push({
      filename: clFileName,
      content: clData
    });
  }

  // Add CV attachment if provided (only real PDF/Word files, not HTML)
  if (cvData && cvFileName && !cvFileName.endsWith('.html')) {
    var base64Content = cvData;
    if (typeof base64Content === "string" && base64Content.includes("base64,")) {
      base64Content = base64Content.split("base64,")[1];
    }
    if (typeof base64Content === "string" && !base64Content.match(/^[A-Za-z0-9+/=\s]+$/)) {
      base64Content = Buffer.from(base64Content, "utf-8").toString("base64");
    }
    if (!emailPayload.attachments) emailPayload.attachments = [];
    emailPayload.attachments.push({ filename: cvFileName, content: base64Content });
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
