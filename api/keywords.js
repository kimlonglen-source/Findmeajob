/* Keyword-research proxy for the /admin Keywords tab.
   Two actions:
     action=cse  -> Google Custom Search JSON API (top 10 SERP for one keyword)
     action=gsc  -> Google Search Console (top queries for findmeajob.co.nz)
   Both admin-gated by ADMIN_PASSWORD and rate-limited per IP. */

var rateLimitMap = {};
function checkRateLimit(ip) {
  var now = Date.now();
  if (!rateLimitMap[ip] || rateLimitMap[ip].resetAt < now) {
    rateLimitMap[ip] = { count: 1, resetAt: now + 60000 };
    return true;
  }
  rateLimitMap[ip].count++;
  if (rateLimitMap[ip].count > 60) return false;
  return true;
}

module.exports = async function handler(req, res) {
  var PASS = process.env.ADMIN_PASSWORD;
  if (!PASS) return res.status(500).json({ error: "ADMIN_PASSWORD not set" });
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  var ip = req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "unknown";
  if (!checkRateLimit(ip)) return res.status(429).json({ error: "Too many requests. Wait a minute." });

  var body = req.body || {};
  if (body.password !== PASS) return res.status(401).json({ error: "Unauthorised" });

  var action = body.action;

  // --- Google Custom Search JSON API -----------------------------------
  if (action === "cse") {
    var cseKey = process.env.GOOGLE_CSE_API_KEY;
    var cseId = process.env.GOOGLE_CSE_ID;
    if (!cseKey || !cseId) {
      return res.status(503).json({
        error: "not_configured",
        message: "Set GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID env vars. See admin 'Setup' link."
      });
    }
    var q = (body.q || "").toString().trim();
    if (!q) return res.status(400).json({ error: "Missing q" });
    if (q.length > 200) return res.status(400).json({ error: "q too long" });

    try {
      var url = "https://www.googleapis.com/customsearch/v1?key=" + encodeURIComponent(cseKey)
        + "&cx=" + encodeURIComponent(cseId)
        + "&q=" + encodeURIComponent(q)
        + "&num=10&gl=nz&cr=countryNZ&safe=active";
      var r = await fetch(url);
      if (!r.ok) {
        var errText = await r.text();
        return res.status(502).json({ error: "cse_failed", status: r.status, detail: errText.slice(0, 400) });
      }
      var data = await r.json();
      var items = (data.items || []).map(function(it) {
        return { title: it.title, link: it.link, snippet: it.snippet, displayLink: it.displayLink };
      });
      var total = (data.searchInformation && parseInt(data.searchInformation.totalResults, 10)) || 0;
      return res.status(200).json({
        q: q,
        total: total,
        items: items,
        searchTime: data.searchInformation && data.searchInformation.searchTime
      });
    } catch (e) {
      return res.status(500).json({ error: "cse_error", detail: String(e).slice(0, 300) });
    }
  }

  // --- Google Search Console (stub until OAuth/service-account wired) ---
  if (action === "gsc") {
    var gscKey = process.env.GOOGLE_GSC_SA_KEY;
    var gscSite = process.env.GOOGLE_GSC_SITE;
    if (!gscKey || !gscSite) {
      return res.status(503).json({
        error: "not_configured",
        message: "Search Console is not wired up yet. Will ship in a follow-up PR - needs a service-account JSON key (GOOGLE_GSC_SA_KEY) and site URL (GOOGLE_GSC_SITE)."
      });
    }
    return res.status(501).json({ error: "not_implemented", message: "GSC wiring is a follow-up." });
  }

  return res.status(400).json({ error: "Unknown action. Use 'cse' or 'gsc'." });
};
