module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return res.status(200).json({ jobs: [] });

  const { query, region, limit } = req.body;
  const perPage = limit || 20;
  const clean = (query || '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 3).join(' ');

  const locationMap = {
    'Auckland': 'Auckland', 'Wellington': 'Wellington',
    'Canterbury / Christchurch': 'Christchurch', 'Waikato / Hamilton': 'Hamilton',
    'Bay of Plenty': 'Tauranga', 'Otago / Dunedin': 'Dunedin',
    'Manawatu-Whanganui': 'Palmerston North', 'Hawkes Bay': 'Napier',
    'Northland': 'Whangarei', 'Southland': 'Invercargill',
    'Nelson / Marlborough': 'Nelson', 'New Zealand': ''
  };
  const loc = locationMap[region] || '';

  // Known legitimate NZ job board domains that Adzuna redirects through
  const NZ_DOMAINS = ['.co.nz', '.nz', 'seek.com.au/job', 'trademe.co.nz', 'linkedin.com/jobs'];
  
  // Domains that are definitely NOT NZ jobs
  const OVERSEAS_DOMAINS = [
    'newparadigmstaffing.com', 'ziprecruiter.com', 'simplyhired.com',
    'careerbuilder.com', 'monster.com', '.com.au/job', 'seek.com.au/job-detail',
    'workday.com', 'greenhouse.io', 'lever.co', 'smartrecruiters.com',
    'bamboohr.com', 'icims.com', 'taleo.net', 'successfactors.com',
    'jobvite.com', 'paylocity.com', 'ultipro.com', 'adp.com/jobs',
    'myworkday.com', 'hire.withgoogle.com', 'careers.google.com'
  ];

  function isNZJob(job) {
    const area = job.location && job.location.area ? job.location.area : [];
    const url = (job.redirect_url || '').toLowerCase();

    // Must have New Zealand as first area element
    if (area.length > 0 && area[0] !== 'New Zealand') return false;

    // Reject known overseas domains
    for (const d of OVERSEAS_DOMAINS) {
      if (url.includes(d)) return false;
    }

    // If URL is a .com (not .co.nz), check it's going through adzuna NZ redirect
    // Adzuna NZ jobs redirect through adzuna.com.au or adzuna.co.nz
    if (url.includes('adzuna.com/land') || url.includes('adzuna.com.au/land')) {
      // These are properly tagged NZ jobs going through adzuna redirect - allow them
      return true;
    }

    return true;
  }

  function buildUrl(q, where, n) {
    let url = `https://api.adzuna.com/v1/api/jobs/nz/search/1`
      + `?app_id=${appId}&app_key=${appKey}`
      + `&results_per_page=${n}`
      + `&what=${encodeURIComponent(q)}`
      + `&location0=New+Zealand`
      + `&sort_by=relevance`
      + `&content-type=application/json`;
    if (where) url += `&where=${encodeURIComponent(where)}`;
    return url;
  }

  async function fetchAndFilter(q, where, n) {
    const r = await fetch(buildUrl(q, where, n), { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.results || []).filter(isNZJob);
  }

  try {
    let jobs = await fetchAndFilter(clean, loc, 50);
    if (jobs.length < 5 && clean.includes(' ')) {
      jobs = await fetchAndFilter(clean.split(' ')[0], loc, 50);
    }
    return res.status(200).json({ jobs: shape(jobs.slice(0, perPage)) });
  } catch (e) {
    return res.status(200).json({ jobs: [] });
  }
};

function shape(results) {
  return results.map(j => ({
    title: j.title || '',
    company: j.company && j.company.display_name ? j.company.display_name : 'Company not listed',
    location: j.location && j.location.display_name ? j.location.display_name : 'New Zealand',
    salary: j.salary_min ? `$${Math.round(j.salary_min/1000)}K${j.salary_max?'-$'+Math.round(j.salary_max/1000)+'K':'+' } NZD` : null,
    description: j.description ? j.description.replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim().substring(0,200)+'...' : '',
    url: j.redirect_url || '#'
  }));
}
