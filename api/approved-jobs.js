var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hset = _kv.hset;
var hgetall = _kv.hgetall;

var PLAN_DAYS = { free: 30, basic: 60, pro: 90 };

var statsCache = { data: null, expires: 0 };

module.exports = async function handler(req, res) {
  // POST = track event
  if (req.method === "POST") {
    if (!getKV()) return res.status(200).json({ ok: true });
    try {
      var jobId = req.body.jobId;
      var type = req.body.type;
      if (type === "cv-upload") {
        var count = await hget("stats", "cv-uploads");
        count = count ? (parseInt(count) || 0) + 1 : 1;
        await hset("stats", "cv-uploads", String(count));
        return res.status(200).json({ ok: true });
      }
      if (type === "leaderboard") {
        var roles = req.body.roles;
        if (!roles || !Array.isArray(roles)) return res.status(200).json({ ok: true });
        var lbRaw = await hget("stats", "leaderboard");
        var lb = {};
        try { lb = lbRaw ? (typeof lbRaw === "string" ? JSON.parse(lbRaw) : lbRaw) : {}; } catch(e) { lb = {}; }
        roles.slice(0, 4).forEach(function(role) {
          var key = role.trim().substring(0, 60);
          if (!key) return;
          lb[key] = (lb[key] || 0) + 1;
        });
        await hset("stats", "leaderboard", JSON.stringify(lb));
        return res.status(200).json({ ok: true });
      }
      if (type === "save-blog") {
        var blogPw = req.body.password;
        var adminPw = process.env.ADMIN_PASSWORD;
        if (!blogPw || blogPw !== adminPw) return res.status(200).json({ ok: false });
        var posts = req.body.posts;
        if (!posts || !Array.isArray(posts)) return res.status(200).json({ ok: false });
        var existing = await hget("stats", "blog-posts");
        var allPosts = [];
        try { allPosts = existing ? JSON.parse(existing) : []; } catch(e) { allPosts = []; }
        posts.forEach(function(p) { allPosts.unshift(p); });
        if (allPosts.length > 50) allPosts = allPosts.slice(0, 50);
        await hset("stats", "blog-posts", JSON.stringify(allPosts));
        return res.status(200).json({ ok: true });
      }
      if (type === "replace-blog") {
        var rBlogPw = req.body.password;
        var rAdminPw = process.env.ADMIN_PASSWORD;
        if (!rBlogPw || rBlogPw !== rAdminPw) return res.status(200).json({ ok: false });
        var rPosts = req.body.posts;
        if (!Array.isArray(rPosts)) return res.status(200).json({ ok: false });
        await hset("stats", "blog-posts", JSON.stringify(rPosts));
        return res.status(200).json({ ok: true });
      }
      if (!jobId || !type) return res.status(200).json({ ok: true });
      if (type !== "view" && type !== "apply") return res.status(200).json({ ok: true });
      var raw = await hget("jobs", jobId);
      if (!raw) return res.status(200).json({ ok: true });
      var job = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (type === "view") job.views = (job.views || 0) + 1;
      if (type === "apply") job.applies = (job.applies || 0) + 1;
      await hset("jobs", jobId, job);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(200).json({ ok: true });
    }
  }

  // GET ?leaderboard=1
  if (req.query && req.query.leaderboard === "1") {
    try {
      if (!getKV()) return res.status(200).json({ leaderboard: [] });
      var lbRaw2 = await hget("stats", "leaderboard");
      var lb2 = {};
      try { lb2 = lbRaw2 ? (typeof lbRaw2 === "string" ? JSON.parse(lbRaw2) : lbRaw2) : {}; } catch(e) { lb2 = {}; }
      var sorted = Object.keys(lb2).map(function(k) { return { role: k, count: lb2[k] }; })
        .sort(function(a, b) { return b.count - a.count; }).slice(0, 10);
      return res.status(200).json({ leaderboard: sorted });
    } catch(e) { return res.status(200).json({ leaderboard: [] }); }
  }

  // GET ?blog=1
  if (req.query && req.query.blog === "1") {
    try {
      if (!getKV()) return res.status(200).json({ posts: [] });
      var blogRaw = await hget("stats", "blog-posts");
      var blogPosts = [];
      try { blogPosts = blogRaw ? JSON.parse(blogRaw) : []; } catch(e) { blogPosts = []; }
      return res.status(200).json({ posts: blogPosts });
    } catch(e) { return res.status(200).json({ posts: [] }); }
  }

  // GET ?blogPage=1 — server-rendered blog HTML
  if (req.query && req.query.blogPage === "1") {
    var bPosts = [];
    try { if (getKV()) { var bRaw = await hget("stats", "blog-posts"); bPosts = bRaw ? JSON.parse(bRaw) : []; } } catch(e) { bPosts = []; }
    var bHtml = "";
    var bSchema = [];
    function bEsc(s) { return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
    if (bPosts.length) {
      var bGrads = {seeker:"linear-gradient(135deg,#059669,#10b981)",employer:"linear-gradient(135deg,#d97706,#f59e0b)",market:"linear-gradient(135deg,#7c3aed,#8b5cf6)",tips:"linear-gradient(135deg,#db2777,#ec4899)"};
      bPosts.forEach(function(p, idx) {
        var slug = (p.title||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").substring(0,60);
        var tc = p.category||"market";
        var tl = p.categoryLabel||p.category||"Insight";
        var t = bEsc(p.title);
        var ex = bEsc(p.excerpt);
        var bd = bEsc(p.body).replace(/\n\n/g,"</p><p>").replace(/\n/g,"<br>");
        var dt = bEsc(p.date);
        var ic = (p.icon||"📝").replace(/</g,"&lt;");
        var gr = bGrads[tc]||bGrads.market;
        var imgId = p.imageId||(idx*37+100);
        bHtml += '<article class="post-card" id="'+slug+'" itemscope itemtype="https://schema.org/BlogPosting">';
        bHtml += '<div style="position:relative;height:200px;border-radius:var(--rl) var(--rl) 0 0;margin:-1.5rem -1.5rem 1rem;display:flex;align-items:flex-end;overflow:hidden"><img src="https://picsum.photos/seed/'+imgId+'/800/400" alt="'+t+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.style.background=\''+gr+'\'">';
        bHtml += '<div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.75) 0%,transparent 50%)"></div>';
        bHtml += '<div style="position:relative;padding:1.25rem;display:flex;align-items:center;gap:.75rem;width:100%">';
        bHtml += '<span style="font-size:2rem" role="img">'+ic+'</span>';
        bHtml += '<div><div class="post-tag '+tc+'" style="margin-bottom:.2rem;background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.3);color:#fff">'+tl+'</div>';
        bHtml += '<time class="post-date" itemprop="datePublished" style="color:rgba(255,255,255,.6)">'+dt+'</time></div>';
        bHtml += '</div></div>';
        bHtml += '<meta itemprop="image" content="https://picsum.photos/seed/'+imgId+'/800/400">';
        bHtml += '<h2 class="post-title" itemprop="headline">'+t+'</h2>';
        bHtml += '<p itemprop="description" style="font-size:.88rem;color:var(--text2);line-height:1.7;margin-bottom:.75rem">'+ex+'</p>';
        bHtml += '<div itemprop="articleBody" style="font-size:.88rem;color:var(--text2);line-height:1.8"><p>'+bd+'</p></div>';
        bHtml += '<meta itemprop="author" content="FindMeAJob.co.nz"><meta itemprop="publisher" content="FindMeAJob.co.nz">';
        bHtml += '</article>';
        bSchema.push('{"@type":"BlogPosting","headline":"'+t.replace(/"/g,'\\"')+'","description":"'+ex.replace(/"/g,'\\"')+'","datePublished":"'+dt+'","author":{"@type":"Organization","name":"FindMeAJob.co.nz"},"publisher":{"@type":"Organization","name":"FindMeAJob.co.nz"}}');
      });
    } else { bHtml = '<div class="empty-state">No posts yet. Check back soon!</div>'; }
    var ogImg = bPosts.length && bPosts[0].imageId ? 'https://picsum.photos/seed/'+bPosts[0].imageId+'/1200/630' : 'https://www.findmeajob.co.nz/favicon-512.png';
    var schemaJson = '{"@context":"https://schema.org","@type":"Blog","name":"FindMeAJob.co.nz Blog","description":"Daily insights on the NZ job market.","url":"https://www.findmeajob.co.nz/blog","publisher":{"@type":"Organization","name":"FindMeAJob.co.nz","url":"https://www.findmeajob.co.nz"},"blogPost":['+bSchema.join(",")+']}';
    var page = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>NZ Job Market Blog — Career Tips for Seekers &amp; Employers | FindMeAJob.co.nz</title><meta name="description" content="Daily insights on the NZ job market, career advice, hiring tips for employers, and job seeker guides."><meta name="robots" content="index, follow"><link rel="canonical" href="https://www.findmeajob.co.nz/blog"><meta property="og:type" content="website"><meta property="og:url" content="https://www.findmeajob.co.nz/blog"><meta property="og:title" content="NZ Job Market Blog — FindMeAJob.co.nz"><meta property="og:description" content="Daily insights on the NZ job market for job seekers and employers."><meta property="og:image" content="'+ogImg+'"><meta name="twitter:card" content="summary_large_image"><link rel="icon" type="image/svg+xml" href="/logo-icon.svg"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"><script type="application/ld+json">'+schemaJson+'</script><style>:root{--bg:#09090b;--bg2:rgba(255,255,255,.03);--text:#f8fafc;--text2:#a1a1aa;--text3:#71717a;--em:#10b981;--purple:#8b5cf6;--pink:#ec4899;--gold:#f59e0b;--border:rgba(255,255,255,.06);--border2:rgba(255,255,255,.1);--r:12px;--rl:20px}*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--text);font-family:"Inter",system-ui,sans-serif;min-height:100vh;font-size:15px;line-height:1.6}a{color:var(--em);text-decoration:none}a:hover{text-decoration:underline}.top-bar{display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;border-bottom:1px solid var(--border)}.top-logo{font-size:.95rem;font-weight:800;color:var(--text);text-decoration:none}.top-logo span{color:var(--em)}.top-logo:hover{text-decoration:none}.top-links{display:flex;gap:1rem;font-size:.82rem;font-weight:600}.top-links a{color:var(--text2)}.top-links a:hover{color:var(--text)}.blog-header{text-align:center;padding:3rem 2rem 2rem}.blog-header h1{font-size:1.8rem;font-weight:900;margin-bottom:.35rem}.blog-header p{color:var(--text2);font-size:.9rem;max-width:500px;margin:0 auto}.posts{max-width:720px;margin:0 auto;padding:0 1.5rem 3rem}.post-card{border:1px solid var(--border);border-radius:var(--rl);padding:1.5rem;margin-top:1.25rem;background:var(--bg2)}.post-tag{display:inline-block;font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.8px;padding:.2rem .6rem;border-radius:999px;margin-bottom:.6rem}.post-tag.seeker{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);color:var(--em)}.post-tag.employer{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:var(--gold)}.post-tag.market{background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);color:var(--purple)}.post-tag.tips{background:rgba(236,72,153,.08);border:1px solid rgba(236,72,153,.2);color:var(--pink)}.post-title{font-size:1.15rem;font-weight:800;color:var(--text);margin-bottom:.35rem;line-height:1.3}.post-date{font-size:.72rem;color:var(--text3);font-weight:500;display:block;margin-bottom:.65rem}.empty-state{text-align:center;padding:4rem 2rem;color:var(--text3);font-size:.9rem}.blog-cta{text-align:center;padding:2rem;margin-top:1rem}.blog-cta a{display:inline-block;padding:.6rem 1.5rem;background:linear-gradient(135deg,var(--em),#14b8a6);color:#fff;border-radius:999px;font-size:.85rem;font-weight:700;text-decoration:none}@media(max-width:600px){.top-bar{padding:.75rem 1rem}.blog-header{padding:2rem 1rem 1.5rem}.blog-header h1{font-size:1.4rem}.posts{padding:0 1rem 2rem}.post-card{padding:1.15rem}}</style></head><body><nav class="top-bar"><a class="top-logo" href="/">FindMe<span>AJob</span></a><div class="top-links"><a href="/">Find Jobs</a><a href="/challenge">#cvchallengenz</a><a href="/employer-portal.html">Employers</a></div></nav><header class="blog-header"><h1>NZ Job Market Insights</h1><p>Daily tips for job seekers and employers in Aotearoa New Zealand</p></header><main class="posts">'+bHtml+'</main><div class="blog-cta"><a href="/">Find your next NZ job with AI &rarr;</a></div><footer style="text-align:center;padding:1.5rem;font-size:.72rem;color:var(--text3);border-top:1px solid var(--border);margin-top:1rem"><p>&copy; 2026 FindMeAJob.co.nz &mdash; AI-powered job matching for Aotearoa New Zealand</p><p style="margin-top:.35rem"><a href="/">Home</a> &bull; <a href="/blog">Blog</a> &bull; <a href="/challenge">#cvchallengenz</a> &bull; <a href="/employer-portal.html">Employers</a></p></footer></body></html>';
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).send(page);
  }

  // GET ?stats=1 = public job count
  if (req.query && req.query.stats === "1") {
    var sNow = Date.now();
    if (statsCache.data && sNow < statsCache.expires) return res.status(200).json(statsCache.data);
    try {
      var sResult = { liveJobs: 0, adzunaJobs: 0, totalJobs: 0 };
      if (getKV()) {
        var sRaw = await hgetall("jobs");
        var sDate = new Date();
        sResult.liveJobs = Object.values(sRaw).map(function(j){return typeof j==="string"?JSON.parse(j):j;}).filter(function(j){
          if(j.status!=="approved")return false;var start=j.approvedAt||j.submitted;var days=j.planDays||PLAN_DAYS[j.plan]||30;
          return sDate<new Date(new Date(start).getTime()+days*24*60*60*1000);
        }).length;
      }
      var appId=process.env.ADZUNA_APP_ID,appKey=process.env.ADZUNA_APP_KEY;
      if(appId&&appKey){try{var ar=await fetch("https://api.adzuna.com/v1/api/jobs/nz/search/1?app_id="+appId+"&app_key="+appKey+"&results_per_page=1&what=jobs&location0=New+Zealand",{headers:{"Accept":"application/json"}});if(ar.ok){var ad=await ar.json();sResult.adzunaJobs=ad.count||0;}}catch(e){}}
      sResult.totalJobs = sResult.liveJobs + sResult.adzunaJobs;
      statsCache.data = sResult; statsCache.expires = sNow + 300000;
      return res.status(200).json(sResult);
    } catch(e) { return res.status(200).json({ liveJobs:0, adzunaJobs:0, totalJobs:0 }); }
  }

  // GET = list approved jobs
  try {
    var allRaw = await hgetall("jobs");
    var now = new Date();
    var jobs = Object.values(allRaw)
      .map(function(j) { return typeof j === "string" ? JSON.parse(j) : j; })
      .filter(function(j) {
        if (j.status !== "approved") return false;
        var start = j.approvedAt || j.submitted;
        var days = j.planDays || PLAN_DAYS[j.plan] || 30;
        var expiry = new Date(new Date(start).getTime() + days * 24 * 60 * 60 * 1000);
        return now < expiry;
      })
      .sort(function(a, b) {
        if (b.featured && !a.featured) return 1;
        if (a.featured && !b.featured) return -1;
        if (b.priority && !a.priority) return 1;
        if (a.priority && !b.priority) return -1;
        return new Date(b.approvedAt || b.submitted) - new Date(a.approvedAt || a.submitted);
      });
    return res.status(200).json({ jobs: jobs });
  } catch (err) {
    console.error("approved-jobs error:", err);
    return res.status(200).json({ jobs: [] });
  }
};
