module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  var appId = process.env.ADZUNA_APP_ID;
  var appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return res.status(200).json({ jobs: [] });

  var query = req.body.query;
  var region = req.body.region;
  var limit = req.body.limit;
  var perPage = limit || 20;
  var clean = (query || "").replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 3).join(" ");

  var locationMap = {
    "Auckland": "Auckland", "Wellington": "Wellington", "Canterbury / Christchurch": "Christchurch",
    "Waikato / Hamilton": "Hamilton", "Bay of Plenty": "Tauranga", "Otago / Dunedin": "Dunedin",
    "Manawatu-Whanganui": "Palmerston North", "Hawkes Bay": "Napier", "Northland": "Whangarei",
    "Southland": "Invercargill", "Nelson / Marlborough": "Nelson", "New Zealand": ""
  };
  var loc = locationMap[region] || "";

  function isNZJob(job) {
    var area = (job.location && job.location.area) ? job.location.area : [];
    var url = (job.redirect_url || "").toLowerCase();

    // REQUIRE area[0] === "New Zealand" - reject if area is empty or area[0] is anything else
    if (!area.length || area[0] !== "New Zealand") return false;

    // Adzuna own redirect URLs are fine - they correctly tag NZ jobs
    if (url.includes("adzuna.co.nz") || url.includes("adzuna.com.au/land") || url.includes("adzuna.com/land")) return true;

    // Allow .co.nz and .nz domains
    if (url.includes(".co.nz") || url.includes(".nz/")) return true;

    // Block known overseas recruitment spam domains
    var blocked = [
      "newparadigmstaffing", "staffing.com", "ziprecruiter", "simplyhired",
      "careerbuilder", "monster.com", "workday.com", "greenhouse.io",
      "lever.co", "smartrecruiters", "bamboohr", "icims.com", "taleo",
      "successfactors", "jobvite", "paylocity", "myworkday", "ultipro",
      "indeed.com", "glassdoor", "jora.com", "neuvoo", "talent.com", "jobrapido"
    ];
    for (var i = 0; i < blocked.length; i++) {
      if (url.includes(blocked[i])) return false;
    }

    // For .com domains that are not blocked, allow them through
    // (some legit NZ employers use .com domains)
    return true;
  }

  function buildUrl(q, where, n) {
    var u = "https://api.adzuna.com/v1/api/jobs/nz/search/1"
      + "?app_id=" + appId + "&app_key=" + appKey
      + "&results_per_page=" + n
      + "&what=" + encodeURIComponent(q)
      + "&location0=New+Zealand"
      + "&sort_by=relevance"
      + "&content-type=application/json";
    if (where) u += "&where=" + encodeURIComponent(where);
    return u;
  }

  async function fetchAndFilter(q, where, n) {
    var r = await fetch(buildUrl(q, where, n), { headers: { "Accept": "application/json" } });
    if (!r.ok) return [];
    var data = await r.json();
    return (data.results || []).filter(isNZJob);
  }

  try {
    var jobs = await fetchAndFilter(clean, loc, 50);
    if (jobs.length < 5 && clean.includes(" ")) {
      jobs = await fetchAndFilter(clean.split(" ")[0], loc, 50);
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
