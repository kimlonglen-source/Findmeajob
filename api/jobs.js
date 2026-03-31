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

  // Map frontend region names to Adzuna search terms AND acceptable location keywords
  var regionConfig = {
    "Auckland": { where: "Auckland", match: ["auckland"] },
    "Wellington": { where: "Wellington", match: ["wellington", "lower hutt", "upper hutt", "porirua", "hutt"] },
    "Canterbury / Christchurch": { where: "Christchurch", match: ["christchurch", "canterbury", "rangiora", "rolleston"] },
    "Waikato / Hamilton": { where: "Hamilton", match: ["hamilton", "waikato", "cambridge", "te awamutu"] },
    "Bay of Plenty": { where: "Tauranga", match: ["tauranga", "bay of plenty", "rotorua", "whakatane", "mount maunganui"] },
    "Otago / Dunedin": { where: "Dunedin", match: ["dunedin", "otago", "queenstown", "wanaka"] },
    "Manawatu-Whanganui": { where: "Palmerston North", match: ["palmerston north", "manawatu", "whanganui", "wanganui"] },
    "Hawkes Bay": { where: "Napier", match: ["napier", "hastings", "hawke", "havelock north"] },
    "Northland": { where: "Whangarei", match: ["whangarei", "northland", "kerikeri", "kaitaia"] },
    "Southland": { where: "Invercargill", match: ["invercargill", "southland", "gore"] },
    "Nelson / Marlborough": { where: "Nelson", match: ["nelson", "marlborough", "blenheim", "richmond", "tasman"] },
    "New Zealand": { where: "", match: [] }
  };

  var config = regionConfig[region] || regionConfig["New Zealand"];
  var loc = config.where;
  var regionKeywords = config.match;
  var filterByRegion = regionKeywords.length > 0;

  function isNZJob(job) {
    var area = (job.location && job.location.area) ? job.location.area : [];
    var url = (job.redirect_url || "").toLowerCase();
    var title = (job.title || "").toLowerCase();
    var company = (job.company && job.company.display_name) ? job.company.display_name.toLowerCase() : "";
    var desc = (job.description || "").toLowerCase();
    var locationDisplay = (job.location && job.location.display_name) ? job.location.display_name.toLowerCase() : "";

    // REQUIRE area[0] === "New Zealand"
    if (!area.length || area[0] !== "New Zealand") return false;

    // Filter by selected region
    if (filterByRegion) {
      var regionMatch = false;
      var allLocationText = locationDisplay + " " + area.join(" ").toLowerCase();
      // Reject if location is just "New Zealand" with no specific region
      if (locationDisplay === "new zealand" || locationDisplay === "") return false;
      for (var r = 0; r < regionKeywords.length; r++) {
        if (allLocationText.indexOf(regionKeywords[r]) !== -1) { regionMatch = true; break; }
      }
      if (!regionMatch) return false;
    }

    // Block suspicious titles
    var spamTitles = [
      "no experience needed", "no experience required", "entry level remote",
      "work from home", "work from anywhere", "remote usa", "remote us ",
      "hiring immediately", "urgently hiring", "immediate start remote"
    ];
    for (var st = 0; st < spamTitles.length; st++) {
      if (title.includes(spamTitles[st])) return false;
    }

    // Block suspicious companies
    var spamCompanies = [
      "staffing.com", "staffing.co", "centergroupstaffing", "newparadigmstaffing",
      "medixpressrx", "paradigmstaffing", "centergroup", "remote.co",
      "remoteworker", "hiringdepot", "talentburst", "insightstaffing",
      "flexjobs", "remoteok", "weworkremotely"
    ];
    for (var sc = 0; sc < spamCompanies.length; sc++) {
      if (company.includes(spamCompanies[sc])) return false;
    }

    // Block international terms in description
    var blocked = ["united states", "us citizen", "us-based", "w-2", "401k", "401(k)", "hipaa",
      "usa only", "us only", "based in the us", "based in us", "remote - us", "remote us",
      "usd per", "$ usd", "dollar per hour", "est/pst", "eastern time", "pacific time",
      "australian", "sydney", "melbourne", "brisbane", "uk based", "london", "manchester"];
    for (var b = 0; b < blocked.length; b++) {
      if (desc.includes(blocked[b])) return false;
    }

    // Adzuna own URLs are fine
    if (url.includes("adzuna.co.nz") || url.includes("adzuna.com.au/land") || url.includes("adzuna.com/land")) return true;

    // Allow NZ domains
    if (url.includes(".co.nz") || url.includes(".nz/")) return true;

    // Block known overseas domains
    var blockedDomains = [
      "staffing", "ziprecruiter", "simplyhired", "careerbuilder", "monster.com",
      "workday.com", "greenhouse.io", "lever.co", "smartrecruiters", "bamboohr",
      "icims.com", "taleo", "successfactors", "jobvite", "paylocity", "myworkday",
      "ultipro", "indeed.com", "glassdoor", "jora.com", "neuvoo", "talent.com",
      "jobrapido", "recruit.net", "snagajob", "lensa.com", "salary.com", "ladders.com",
      "dice.com", "mediabistro", "flexjobs.com", "remote.co", "remoteok"
    ];
    for (var d = 0; d < blockedDomains.length; d++) {
      if (url.includes(blockedDomains[d])) return false;
    }

    // Generic .com without NZ sub-region
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
    // If regional search returns few results, try without location filter
    if (jobs.length < 5 && loc) {
      var broadJobs = await fetchAndFilter(clean, "", 50);
      // Add broad results that aren't duplicates
      var existingIds = {};
      jobs.forEach(function(j) { existingIds[(j.title||'')+(j.company&&j.company.display_name||'')] = true; });
      broadJobs.forEach(function(j) {
        var key = (j.title||'')+(j.company&&j.company.display_name||'');
        if (!existingIds[key]) { jobs.push(j); existingIds[key] = true; }
      });
    }
    // If still few results and multi-word query, try first word only
    if (jobs.length < 5 && clean.includes(" ")) {
      var firstWord = clean.split(" ")[0];
      var moreJobs = await fetchAndFilter(firstWord, loc || "", 50);
      var existingIds2 = {};
      jobs.forEach(function(j) { existingIds2[(j.title||'')+(j.company&&j.company.display_name||'')] = true; });
      moreJobs.forEach(function(j) {
        var key = (j.title||'')+(j.company&&j.company.display_name||'');
        if (!existingIds2[key]) { jobs.push(j); existingIds2[key] = true; }
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
