module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return res.status(200).json({ jobs: [] });
  const { query, region } = req.body;
  const clean = (query || '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 3).join(' ');
  const locationMap = {
    'Auckland': 'Auckland', 'Wellington': 'Wellington', 'Canterbury / Christchurch': 'Christchurch',
    'Waikato / Hamilton': 'Hamilton', 'Bay of Plenty': 'Tauranga', 'Otago / Dunedin': 'Dunedin',
    'Manawatu-Whanganui': 'Palmerston North', 'Hawkes Bay': 'Napier', 'Northland': 'Whangarei',
    'Southland': 'Invercargill', 'Nelson / Marlborough': 'Nelson', 'New Zealand': ''
  };
  const loc = locationMap[region] || '';
  let url = `https://api.adzuna.com/v1/api/jobs/nz/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=5&what=${encodeURIComponent(clean)}&sort_by=relevance`;
  if (loc) url += `&where=${encodeURIComponent(loc)}`;
  try {
    const r = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!r.ok) return res.status(200).json({ jobs: [] });
    const data = await r.json();
    if (!data.results || !data.results.length) {
      const word = clean.split(' ')[0];
      const r2 = await fetch(`https://api.adzuna.com/v1/api/jobs/nz/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=5&what=${encodeURIComponent(word)}&sort_by=relevance`, { headers: { 'Accept': 'application/json' } });
      if (r2.ok) { const d2 = await r2.json(); if (d2.results && d2.results.length) return res.status(200).json({ jobs: shape(d2.results) }); }
      return res.status(200).json({ jobs: [] });
    }
    return res.status(200).json({ jobs: shape(data.results) });
  } catch (e) {
    return res.status(200).json({ jobs: [] });
  }
};

function shape(results) {
  return results.map(j => ({
    title: j.title || '',
    company: j.company && j.company.display_name ? j.company.display_name : 'Company not listed',
    location: j.location && j.location.display_name ? j.location.display_name : 'New Zealand',
    salary: j.salary_min ? `$${Math.round(j.salary_min / 1000)}K${j.salary_max ? '–$' + Math.round(j.salary_max / 1000) + 'K' : '+'} NZD` : null,
    description: j.description ? j.description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 200) + '...' : '',
    url: j.redirect_url || '#'
  }));
}
