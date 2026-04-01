module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  var query = req.body.query;
  var region = req.body.region;
  var limit = req.body.limit;
  var perPage = limit || 25;
  var clean = (query || "").replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).slice(0, 3).join(" ");
  if (!clean) clean = "jobs";

  var locationMap = {
    "Auckland": "Auckland", "Wellington": "Wellington", "Canterbury / Christchurch": "Christchurch",
    "Waikato / Hamilton": "Hamilton", "Bay of Plenty": "Tauranga", "Otago / Dunedin": "Dunedin",
    "Manawatu-Whanganui": "Palmerston North", "Hawkes Bay": "Napier", "Northland": "Whangarei",
    "Southland": "Invercargill", "Nelson / Marlborough": "Nelson", "New Zealand": ""
  };
  var loc = locationMap[region] || "";
  var locationLabel = loc || "New Zealand";

  // Spam filters
  var spamTitles = ["no experience needed","no experience required","entry level remote","work from home","work from anywhere","remote usa","hiring immediately","urgently hiring"];
  var spamDesc = ["united states","us citizen","us-based","w-2","401k","401(k)","hipaa","usa only","us only","usd per","eastern time","pacific time","sydney","melbourne","brisbane","uk based","london","manchester"];

  function isCleanJob(title, desc, company) {
    var t = (title || "").toLowerCase();
    var d = (desc || "").toLowerCase();
    var c = (company || "").toLowerCase();
    for (var i = 0; i < spamTitles.length; i++) { if (t.indexOf(spamTitles[i]) !== -1) return false; }
    for (var j = 0; j < spamDesc.length; j++) { if (d.indexOf(spamDesc[j]) !== -1) return false; }
    if (c.indexOf("staffing") !== -1 || c.indexOf("remoteok") !== -1 || c.indexOf("flexjobs") !== -1) return false;
    return true;
  }

  var allJobs = [];
  var seen = {};

  function addJob(job) {
    var key = (job.title + job.company).toLowerCase().replace(/\s+/g, "");
    if (seen[key]) return;
    seen[key] = true;
    allJobs.push(job);
  }

  // Fetch from all sources in parallel
  var promises = [];

  // 1. ADZUNA
  var adzunaId = process.env.ADZUNA_APP_ID;
  var adzunaKey = process.env.ADZUNA_APP_KEY;
  if (adzunaId && adzunaKey) {
    var adzunaUrl = "https://api.adzuna.com/v1/api/jobs/nz/search/1"
      + "?app_id=" + adzunaId + "&app_key=" + adzunaKey
      + "&results_per_page=30"
      + "&what=" + encodeURIComponent(clean)
      + "&location0=New+Zealand"
      + "&sort_by=relevance"
      + "&content-type=application/json";
    if (loc) adzunaUrl += "&where=" + encodeURIComponent(loc);

    promises.push(
      fetch(adzunaUrl, { headers: { "Accept": "application/json" } })
        .then(function(r) { return r.ok ? r.json() : { results: [] }; })
        .then(function(data) {
          (data.results || []).forEach(function(j) {
            var area = (j.location && j.location.area) ? j.location.area : [];
            if (!area.length || area[0] !== "New Zealand") return;
            var title = j.title || "";
            var company = j.company && j.company.display_name ? j.company.display_name : "Company not listed";
            var desc = j.description ? j.description.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 200) + "..." : "";
            var location = j.location && j.location.display_name ? j.location.display_name : "New Zealand";
            if (!isCleanJob(title, desc, company)) return;
            addJob({
              title: title, company: company, location: location,
              salary: j.salary_min ? "$" + Math.round(j.salary_min / 1000) + "K" + (j.salary_max ? "-$" + Math.round(j.salary_max / 1000) + "K" : "+") + " NZD" : null,
              description: desc, url: j.redirect_url || "#", source: "Adzuna"
            });
          });
        })
        .catch(function() {})
    );

    // Also try without location if regional
    if (loc) {
      var adzunaBroad = adzunaUrl.replace("&where=" + encodeURIComponent(loc), "");
      promises.push(
        fetch(adzunaBroad, { headers: { "Accept": "application/json" } })
          .then(function(r) { return r.ok ? r.json() : { results: [] }; })
          .then(function(data) {
            (data.results || []).forEach(function(j) {
              var area = (j.location && j.location.area) ? j.location.area : [];
              if (!area.length || area[0] !== "New Zealand") return;
              var title = j.title || "";
              var company = j.company && j.company.display_name ? j.company.display_name : "Company not listed";
              var desc = j.description ? j.description.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 200) + "..." : "";
              var location = j.location && j.location.display_name ? j.location.display_name : "New Zealand";
              if (!isCleanJob(title, desc, company)) return;
              addJob({ title: title, company: company, location: location, salary: j.salary_min ? "$" + Math.round(j.salary_min / 1000) + "K" + (j.salary_max ? "-$" + Math.round(j.salary_max / 1000) + "K" : "+") + " NZD" : null, description: desc, url: j.redirect_url || "#", source: "Adzuna" });
            });
          })
          .catch(function() {})
      );
    }
  }

  // 2. JOOBLE
  var joobleKey = process.env.JOOBLE_API_KEY;
  if (joobleKey) {
    promises.push(
      fetch("https://jooble.org/api/" + joobleKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: clean, location: "New Zealand", page: 1 })
      })
        .then(function(r) { console.log("Jooble status:", r.status); return r.ok ? r.json() : { jobs: [] }; })
        .then(function(data) {
          console.log("Jooble returned:", (data.jobs || []).length, "jobs");
          (data.jobs || []).forEach(function(j) {
            var title = j.title ? j.title.replace(/<[^>]+>/g, "") : "";
            var company = j.company || "Company not listed";
            var desc = j.snippet ? j.snippet.replace(/<[^>]+>/g, "").substring(0, 200) + "..." : "";
            var location = j.location || "New Zealand";
            // Jooble is queried with location "New Zealand" so results should be NZ
            // Only reject if location explicitly mentions another country
            var locLower = location.toLowerCase();
            var foreignCountries = ["australia","united kingdom","united states","canada","india","philippines","singapore","malaysia","ireland","south africa"];
            var isForeign = false;
            for (var fc = 0; fc < foreignCountries.length; fc++) { if (locLower.indexOf(foreignCountries[fc]) !== -1) { isForeign = true; break; } }
            if (isForeign) return;
            if (!isCleanJob(title, desc, company)) return;
            addJob({ title: title, company: company, location: location, salary: j.salary || null, description: desc, url: j.link || "#", source: "Jooble" });
          });
        })
        .catch(function() {})
    );
  }

  // 3. CAREERJET
  var careerjetKey = process.env.CAREERJET_API_KEY;
  console.log("API keys present - Adzuna:", !!(adzunaId && adzunaKey), "Jooble:", !!joobleKey, "CareerJet:", !!careerjetKey);
  if (careerjetKey) {
    var cjUrl = "https://public.api.careerjet.net/search"
      + "?locale_code=en_NZ"
      + "&keywords=" + encodeURIComponent(clean)
      + "&location=" + encodeURIComponent(locationLabel)
      + "&affid=" + encodeURIComponent(careerjetKey)
      + "&pagesize=30"
      + "&page=1"
      + "&sort=relevance"
      + "&contracttype=&contractperiod=";

    promises.push(
      fetch(cjUrl, { headers: { "Accept": "application/json" } })
        .then(function(r) { console.log("CareerJet status:", r.status); return r.ok ? r.json() : { jobs: [] }; })
        .then(function(data) {
          var cjJobs = data.jobs || data.hits || [];
          console.log("CareerJet returned:", cjJobs.length, "jobs, raw keys:", Object.keys(data).join(","));
          cjJobs.forEach(function(j) {
            var title = (j.title || "").replace(/<[^>]+>/g, "");
            var company = j.company || "Company not listed";
            var desc = (j.description || j.snippet || "").replace(/<[^>]+>/g, "").substring(0, 200) + "...";
            var location = j.locations || j.location || "New Zealand";
            var salary = j.salary || j.salary_min ? j.salary || (j.salary_min + "-" + j.salary_max) : null;
            if (!isCleanJob(title, desc, company)) return;
            addJob({ title: title, company: company, location: location, salary: salary, description: desc, url: j.url || j.link || "#", source: "CareerJet" });
          });
        })
        .catch(function() {})
    );
  }

  try {
    await Promise.all(promises);
    console.log("Total jobs from all sources:", allJobs.length);
    return res.status(200).json({ jobs: allJobs.slice(0, perPage) });
  } catch (e) {
    return res.status(200).json({ jobs: allJobs.slice(0, perPage) });
  }
};
