module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return res.status(200).json({ jobs: [] });
  const { query, region, limit } = req.body;
  const perPage = limit || 20;
  const clean = (query || '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 3).join(' ');
  const locationMap = {
    'Auckland': 'Auckland', 'Wellington': 'Wellington', 'Canterbury / Christchurch': 'Christchurch',
    'Waikato / Hamilton': 'Hamilton', 'Bay of Plenty': 'Tauranga', 'Otago / Dunedin': 'Dunedin',
    'Manawatu-Whanganui': 'Palmerston North', 'Hawkes Bay': 'Napier', 'Northland': 'Whangarei',
    'Southland': 'Invercargill', 'Nelson / Marlborough': 'Nelson', 'New Zealand': ''
  };
  const loc = locationMap[region] || '';

  // NZ locations for filtering
  const NZ_LOCATIONS = [
    'auckland','wellington','christchurch','hamilton','tauranga','dunedin','palmerston north',
    'napier','nelson','rotorua','hastings','new plymouth','invercargill','whangarei','blenheim',
    'gisborne','porirua','upper hutt','lower hutt','kapiti','queenstown','timaru','whanganui',
    'masterton','levin','pukekohe','taupo','ashburton','south auckland','north shore','manukau',
    'waitakere','papakura','new zealand','nz','aotearoa','remote nz','nationwide'
  ];

  // Non-NZ signals to reject
  const OVERSEAS_SIGNALS = [
    'usa','united states','us ','u.s.','canada','uk ','united kingdom','australia','sydney',
    'melbourne','brisbane','perth','adelaide','india','philippines','remote - us','remote - uk',
    'remote - australia','newparadigm','staffing.com','hiring.com','jobs.com','careers.com',
    '.com/jobs','.com/careers','workday.com','greenhouse.io','lever.co','smartrecruiters',
    'paylocity','bamboohr','icims.com','taleo','successfactors'
  ];

  function isNZJob(job) {
    const loc = (job.location && job.location.display_name ? job.location.display_name : '').toLowerCase();
    const url = (job.redirect_url || '').toLowerCase();
    const company = (job.company && job.company.display_name ? job.company.display_name : '').toLowerCase();

    // Reject if URL contains overseas recruitment platform signals
    for (const signal of OVERSEAS_SIGNALS) {
      if (url.includes(signal) || company.includes(signal)) return false;
    }

    // Must have a NZ location OR no location (some legit NZ remote jobs have blank location)
    if (loc) {
      const hasNZLoc = NZ_LOCATIONS.some(nzLoc => loc.includes(nzLoc));
      if (!hasNZLoc) return false;
    }

    // Reject URLs that look like overseas redirect spam
    if (url.includes('utm_source=adzuna') && !url.includes('.co.nz') && !url.includes('.nz')) {
      // Allow if location is clearly NZ
      const hasNZLoc = NZ_LOCATIONS.some(nzLoc => loc.includes(nzLoc));
      if (!hasNZLoc) return false;
    }

    return true;
  }

  async function fetchJobs(q, l, n) {
    let url = `https://api.adzuna.com/v1/api/jobs/nz/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=${n}&what=${encodeURIComponent(q)}&sort_by=relevance&content-type=application/json`;
    if (l) url += `&where=${encodeURIComponent(l)}`;
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return [];
    const data = await r.json();
    return data.results || [];
  }

  try {
    // Fetch more than needed to account for filtered-out overseas jobs
    let results = await fetchJobs(clean, loc, Math.min(perPage * 2, 50));

    // If not enough, try broader search
    if (results.length < 5) {
      const word = clean.split(' ')[0];
      results = await fetchJobs(word, loc, Math.min(perPage * 2, 50));
    }

    // Filter to NZ only
    const nzOnly = results.filter(isNZJob);

    return res.status(200).json({ jobs: shape(nzOnly.slice(0, perPage)) });
  } catch (e) {
    return res.status(200).json({ jobs: [] });
  }
};

function shape(results) {
  return results.map(j => ({
    title: j.title || '',
    company: j.company && j.company.display_name ? j.company.display_name : 'Company not listed',
    location: j.location && j.location.display_name ? j.location.display_name : 'New Zealand',
    salary: j.salary_min ? `$${Math.round(j.salary_min / 1000)}K${j.salary_max ? '-$' + Math.round(j.salary_max / 1000) + 'K' : '+'} NZD` : null,
    description: j.description ? j.description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 200) + '...' : '',
    url: j.redirect_url || '#'
  }));
}
