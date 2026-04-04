module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  var appId = process.env.ADZUNA_APP_ID;
  var appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return res.status(200).json({ jobs: [] });

  var query = req.body.query;
  var limit = req.body.limit;
  var perPage = limit || 50;
  var clean = (query || "").replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 3).join(" ");
  if (!clean) clean = "jobs";

  // Spam filters
  var spamTitles = ["no experience needed","no experience required","entry level remote","work from home","work from anywhere","remote usa","hiring immediately","urgently hiring"];
  var spamDesc = ["united states","us citizen","us-based","w-2","401k","401(k)","hipaa","usa only","us only","usd per","eastern time","pacific time","sydney","melbourne","brisbane","uk based","london","manchester","staffordshire","birmingham","leeds","sheffield","nottingham","bristol","edinburgh","glasgow","cardiff","nhs","band 6","band 7","band 5","perth, western","adelaide","canberra","gold coast"];

  function isNZJob(job) {
    var area = (job.location && job.location.area) ? job.location.area : [];
    var title = (job.title || "").toLowerCase();
    var company = (job.company && job.company.display_name) ? job.company.display_name.toLowerCase() : "";
    var desc = (job.description || "").toLowerCase();

    if (!area.length || area[0] !== "New Zealand") return false;
    for (var i = 0; i < spamTitles.length; i++) { if (title.indexOf(spamTitles[i]) !== -1) return false; }
    for (var j = 0; j < spamDesc.length; j++) { if (desc.indexOf(spamDesc[j]) !== -1) return false; }
    if (company.indexOf("staffing") !== -1 || company.indexOf("remoteok") !== -1 || company.indexOf("flexjobs") !== -1) return false;
    if (desc.indexOf("\u00a3") !== -1) return false;
    return true;
  }

  function buildUrl(q, n, broad) {
    var param = broad ? "&what=" : "&what_and=";
    return "https://api.adzuna.com/v1/api/jobs/nz/search/1"
      + "?app_id=" + appId + "&app_key=" + appKey
      + "&results_per_page=" + n
      + param + encodeURIComponent(q)
      + "&location0=New+Zealand"
      + "&sort_by=relevance";
  }

  async function fetchAndFilter(q, n, broad) {
    var r = await fetch(buildUrl(q, n, broad), { headers: { "Accept": "application/json" } });
    if (!r.ok) return [];
    var data = await r.json();
    return (data.results || []).filter(isNZJob);
  }

  try {
    var jobs = await fetchAndFilter(clean, 50);
    if (jobs.length < 5 && clean.includes(" ")) {
      var moreJobs = await fetchAndFilter(clean, 50, true);
      var ids = {};
      jobs.forEach(function(j) { ids[(j.title || "") + (j.company && j.company.display_name || "")] = true; });
      moreJobs.forEach(function(j) {
        var k = (j.title || "") + (j.company && j.company.display_name || "");
        if (!ids[k]) { jobs.push(j); ids[k] = true; }
      });
    }
    return res.status(200).json({ jobs: shape(jobs.slice(0, perPage)) });
  } catch (e) {
    return res.status(200).json({ jobs: [] });
  }
};

function shape(results) {
  return results.map(function(j) {
    return {
      title: j.title || "",
      company: j.company && j.company.display_name ? j.company.display_name : "Company not listed",
      location: j.location && j.location.display_name ? j.location.display_name : "New Zealand",
      salary: j.salary_min ? "$" + Math.round(j.salary_min / 1000) + "K" + (j.salary_max ? "-$" + Math.round(j.salary_max / 1000) + "K" : "+") + " NZD" : null,
      description: j.description ? j.description.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 200) + "..." : "",
      url: j.redirect_url || "#"
    };
  });
}
