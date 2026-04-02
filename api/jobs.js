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

  // Region keywords for filtering results
  var regionAliases = {
    "Auckland": ["auckland","manukau","north shore","waitakere","papakura","howick","takapuna","albany","botany","east tamaki","ponsonby","newmarket","parnell","remuera","ellerslie","onehunga","mangere","otahuhu","henderson","new lynn","mount eden","epsom","devonport","browns bay","orewa","milford","glenfield","pukekohe"],
    "Wellington": ["wellington","lower hutt","upper hutt","porirua","hutt","petone","johnsonville","miramar","kilbirnie","karori","tawa","paraparaumu","kapiti"],
    "Christchurch": ["christchurch","canterbury","rangiora","rolleston","kaiapoi","lincoln","selwyn","ashburton"],
    "Hamilton": ["hamilton","waikato","cambridge","te awamutu","tokoroa","matamata","thames"],
    "Tauranga": ["tauranga","bay of plenty","rotorua","whakatane","mount maunganui","papamoa","te puke"],
    "Dunedin": ["dunedin","otago","queenstown","wanaka","alexandra","cromwell","oamaru","mosgiel"],
    "Palmerston North": ["palmerston north","manawatu","whanganui","wanganui","feilding","levin"],
    "Napier": ["napier","hastings","hawke","havelock north"],
    "Whangarei": ["whangarei","northland","kerikeri","kaitaia","dargaville"],
    "Invercargill": ["invercargill","southland","gore","te anau"],
    "Nelson": ["nelson","marlborough","blenheim","richmond","tasman","motueka","picton"]
  };
  var regionKeys = loc ? (regionAliases[loc] || [loc.toLowerCase()]) : [];

  // NZ cities for Jooble filtering
  var nzCities = ["new zealand","nz","auckland","wellington","christchurch","hamilton","tauranga","dunedin","queenstown","nelson","napier","hastings","palmerston","invercargill","rotorua","whangarei","whanganui","wanaka","manukau","porirua","canterbury","waikato","otago","taranaki","gisborne","blenheim","timaru","masterton","kapiti","pukekohe","rangiora","rolleston","greymouth","hokitika","kaikoura","picton","motueka","northland","southland","marlborough","hawke","bay of plenty","lower hutt","upper hutt","north island","south island","new plymouth","ashburton","oamaru","gore","cambridge","te awamutu","whakatane","mount maunganui","papamoa","kerikeri","dargaville"];

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

  function isInRegion(locationStr) {
    if (!regionKeys.length) return true;
    var l = (locationStr || "").toLowerCase();
    if (l.indexOf("new zealand") !== -1 && l.length < 15) return true;
    for (var i = 0; i < regionKeys.length; i++) {
      if (l.indexOf(regionKeys[i]) !== -1) return true;
    }
    return false;
  }

  function isNZLocation(locationStr) {
    var l = (locationStr || "").toLowerCase();
    if (!l) return false;
    for (var i = 0; i < nzCities.length; i++) {
      if (l.indexOf(nzCities[i]) !== -1) return true;
    }
    return false;
  }

  var allJobs = [];
  var seen = {};
  function addJob(job) {
    var key = (job.title + job.company).toLowerCase().replace(/\s+/g, "");
    if (seen[key]) return;
    seen[key] = true;
    allJobs.push(job);
  }

  var promises = [];

  // 1. ADZUNA
  var adzunaId = process.env.ADZUNA_APP_ID;
  var adzunaKey = process.env.ADZUNA_APP_KEY;
  if (adzunaId && adzunaKey) {
    var adzunaUrl = "https://api.adzuna.com/v1/api/jobs/nz/search/1"
      + "?app_id=" + adzunaId + "&app_key=" + adzunaKey
      + "&results_per_page=40&what=" + encodeURIComponent(clean)
      + "&location0=New+Zealand&sort_by=relevance";
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
            if (!isInRegion(location)) return;
            addJob({
              title: title, company: company, location: location,
              salary: j.salary_min ? "$" + Math.round(j.salary_min / 1000) + "K" + (j.salary_max ? "-$" + Math.round(j.salary_max / 1000) + "K" : "+") + " NZD" : null,
              description: desc, url: j.redirect_url || "#", source: "Adzuna"
            });
          });
        })
        .catch(function() {})
    );
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
        .then(function(r) { return r.ok ? r.json() : { jobs: [] }; })
        .then(function(data) {
          (data.jobs || []).forEach(function(j) {
            var title = j.title ? j.title.replace(/<[^>]+>/g, "") : "";
            var company = j.company || "Company not listed";
            var desc = j.snippet ? j.snippet.replace(/<[^>]+>/g, "").substring(0, 200) + "..." : "";
            var location = j.location || "";
            if (!isNZLocation(location)) return;
            if (!isCleanJob(title, desc, company)) return;
            if (!isInRegion(location)) return;
            addJob({ title: title, company: company, location: location, salary: j.salary || null, description: desc, url: j.link || "#", source: "Jooble" });
          });
        })
        .catch(function() {})
    );
  }

  // 3. CAREERJET
  var careerjetKey = process.env.CAREERJET_API_KEY;
  if (careerjetKey) {
    var cjUrl = "https://public.api.careerjet.net/search"
      + "?locale_code=en_NZ&keywords=" + encodeURIComponent(clean)
      + "&location=" + encodeURIComponent(loc || "New Zealand")
      + "&pagesize=30&page=1&sort=relevance";
    var cjAuth = "Basic " + Buffer.from(careerjetKey + ":").toString("base64");
    promises.push(
      fetch(cjUrl, { headers: { "Accept": "application/json", "Authorization": cjAuth } })
        .then(function(r) { return r.ok ? r.json() : { jobs: [] }; })
        .then(function(data) {
          (data.jobs || data.hits || []).forEach(function(j) {
            var title = (j.title || "").replace(/<[^>]+>/g, "");
            var company = j.company || "Company not listed";
            var desc = (j.description || j.snippet || "").replace(/<[^>]+>/g, "").substring(0, 200) + "...";
            var location = j.locations || j.location || "New Zealand";
            var salary = (j.salary || j.salary_min) ? (j.salary || (j.salary_min + "-" + j.salary_max)) : null;
            if (!isCleanJob(title, desc, company)) return;
            if (!isInRegion(location)) return;
            addJob({ title: title, company: company, location: location, salary: salary, description: desc, url: j.url || j.link || "#", source: "CareerJet" });
          });
        })
        .catch(function() {})
    );
  }

  try {
    await Promise.all(promises);
    // If region filter left too few results, try again without region
    if (allJobs.length < 3 && loc && adzunaId && adzunaKey) {
      var broadUrl = "https://api.adzuna.com/v1/api/jobs/nz/search/1"
        + "?app_id=" + adzunaId + "&app_key=" + adzunaKey
        + "&results_per_page=40&what=" + encodeURIComponent(clean)
        + "&location0=New+Zealand&sort_by=relevance";
      try {
        var br = await fetch(broadUrl, { headers: { "Accept": "application/json" } });
        if (br.ok) {
          var bd = await br.json();
          (bd.results || []).forEach(function(j) {
            var area = (j.location && j.location.area) ? j.location.area : [];
            if (!area.length || area[0] !== "New Zealand") return;
            var title = j.title || "";
            var company = j.company && j.company.display_name ? j.company.display_name : "Company not listed";
            var desc = j.description ? j.description.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().substring(0, 200) + "..." : "";
            var location = j.location && j.location.display_name ? j.location.display_name : "New Zealand";
            if (!isCleanJob(title, desc, company)) return;
            addJob({ title: title, company: company, location: location, salary: j.salary_min ? "$" + Math.round(j.salary_min / 1000) + "K" + (j.salary_max ? "-$" + Math.round(j.salary_max / 1000) + "K" : "+") + " NZD" : null, description: desc, url: j.redirect_url || "#", source: "Adzuna" });
          });
        }
      } catch(e) {}
    }
    return res.status(200).json({ jobs: allJobs.slice(0, perPage) });
  } catch (e) {
    return res.status(200).json({ jobs: allJobs.slice(0, perPage) });
  }
};
