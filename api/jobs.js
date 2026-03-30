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

  var requestedRegion = region || "";

  function isNZJob(job) {
    var area = (job.location && job.location.area) ? job.location.area : [];
    var url = (job.redirect_url || "").toLowerCase();
    var title = (job.title || "").toLowerCase();
    var company = (job.company && job.company.display_name) ? job.company.display_name.toLowerCase() : "";
    var desc = (job.description || "").toLowerCase();
    var locationDisplay = (job.location && job.location.display_name) ? job.location.display_name.toLowerCase() : "";

    // REQUIRE area[0] === "New Zealand" - reject if area is empty or area[0] is anything else
    if (!area.length || area[0] !== "New Zealand") return false;

    // If a specific region was requested, check the location matches
    if (requestedRegion && requestedRegion !== "New Zealand" && loc) {
      var regionLower = loc.toLowerCase();
      var regionMatch = false;
      // Check area array for region
      for (var a = 0; a < area.length; a++) {
        if (area[a].toLowerCase().indexOf(regionLower) !== -1) regionMatch = true;
      }
      // Check display name
      if (locationDisplay.indexOf(regionLower) !== -1) regionMatch = true;
      // Also check common aliases
      var aliases = {
        "christchurch": ["canterbury","christchurch"],
        "hamilton": ["waikato","hamilton"],
        "tauranga": ["bay of plenty","tauranga"],
        "dunedin": ["otago","dunedin"],
        "palmerston north": ["manawatu","palmerston"],
        "napier": ["hawke","napier","hastings"],
        "whangarei": ["northland","whangarei"],
        "invercargill": ["southland","invercargill"],
        "nelson": ["nelson","marlborough","tasman"]
      };
      if (aliases[regionLower]) {
        for (var al = 0; al < aliases[regionLower].length; al++) {
          if (locationDisplay.indexOf(aliases[regionLower][al]) !== -1) regionMatch = true;
          for (var ar = 0; ar < area.length; ar++) {
            if (area[ar].toLowerCase().indexOf(aliases[regionLower][al]) !== -1) regionMatch = true;
          }
        }
      }
      if (!regionMatch) return false;
    }

    // Block by suspicious title patterns (US-style remote spam)
    var spamTitles = [
      "no experience needed", "no experience required", "entry level remote",
      "work from home", "work from anywhere", "remote usa", "remote us ",
      "hiring immediately", "urgently hiring", "immediate start remote"
    ];
    for (var st = 0; st < spamTitles.length; st++) {
      if (title.includes(spamTitles[st])) return false;
    }

    // Block by suspicious company patterns (overseas staffing agencies)
    var spamCompanies = [
      "staffing.com", "staffing.co", "centergroupstaffing", "newparadigmstaffing",
      "medixpressrx", "paradigmstaffing", "centergroup", "remote.co",
      "remoteworker", "hiringdepot", "talentburst", "insightstaffing",
      "flexjobs", "remoteok", "weworkremotely"
    ];
    for (var sc = 0; sc < spamCompanies.length; sc++) {
      if (company.includes(spamCompanies[sc])) return false;
    }

    // Block descriptions mentioning international/US-specific terms
    var usTerms = ["united states", "us citizen", "us-based", "w-2", "401k", "401(k)", "hipaa",
      "usa only", "us only", "based in the us", "based in us", "remote - us", "remote us",
      "usd per", "$ usd", "dollar per hour", "est/pst", "eastern time", "pacific time",
      "australian", "sydney", "melbourne", "brisbane", "uk based", "london", "manchester"];
    for (var ut = 0; ut < usTerms.length; ut++) {
      if (desc.includes(usTerms[ut])) return false;
    }

    // Adzuna own redirect URLs are fine
    if (url.includes("adzuna.co.nz") || url.includes("adzuna.com.au/land") || url.includes("adzuna.com/land")) return true;

    // Allow .co.nz and .nz domains
    if (url.includes(".co.nz") || url.includes(".nz/")) return true;

    // Block known overseas recruitment spam domains
    var blocked = [
      "staffing", "ziprecruiter", "simplyhired",
      "careerbuilder", "monster.com", "workday.com", "greenhouse.io",
      "lever.co", "smartrecruiters", "bamboohr", "icims.com", "taleo",
      "successfactors", "jobvite", "paylocity", "myworkday", "ultipro",
      "indeed.com", "glassdoor", "jora.com", "neuvoo", "talent.com", "jobrapido",
      "recruit.net", "snagajob", "lensa.com", "salary.com", "ladders.com",
      "dice.com", "mediabistro", "flexjobs.com", "remote.co", "remoteok"
    ];
    for (var i = 0; i < blocked.length; i++) {
      if (url.includes(blocked[i])) return false;
    }

    // For remaining .com domains, check if area has NZ-specific location (area[1] or deeper)
    if (url.includes(".com") && !url.includes(".com.au")) {
      if (area.length < 2) return false;
    }

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
