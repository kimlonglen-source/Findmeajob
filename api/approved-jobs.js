var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;
var hset = _kv.hset;
var hgetall = _kv.hgetall;

var PLAN_DAYS = { free: 30, basic: 60, pro: 90 };

var statsCache = { data: null, expires: 0 };

var BLOG_CSS = ':root{--bg:#09090b;--bg2:rgba(255,255,255,.03);--text:#f8fafc;--text2:#a1a1aa;--text3:#71717a;--em:#10b981;--purple:#8b5cf6;--pink:#ec4899;--gold:#f59e0b;--border:rgba(255,255,255,.06);--border2:rgba(255,255,255,.1);--r:12px;--rl:20px}*{margin:0;padding:0;box-sizing:border-box}body{background:var(--bg);color:var(--text);font-family:"Inter",system-ui,sans-serif;min-height:100vh;font-size:15px;line-height:1.6}a{color:var(--em);text-decoration:none}a:hover{text-decoration:underline}.top-bar{display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;border-bottom:1px solid var(--border)}.top-logo{font-size:.95rem;font-weight:800;color:var(--text);text-decoration:none}.top-logo span{color:var(--em)}.top-logo:hover{text-decoration:none}.top-links{display:flex;gap:1rem;font-size:.82rem;font-weight:600}.top-links a{color:var(--text2)}.top-links a:hover{color:var(--text)}.blog-header{text-align:center;padding:3rem 2rem 2rem}.blog-header h1{font-size:1.8rem;font-weight:900;margin-bottom:.35rem}.blog-header p{color:var(--text2);font-size:.9rem;max-width:500px;margin:0 auto}.posts{max-width:720px;margin:0 auto;padding:0 1.5rem 3rem}.post-card{border:1px solid var(--border);border-radius:var(--rl);padding:1.5rem;margin-top:1.25rem;background:var(--bg2);display:block;text-decoration:none;color:inherit;transition:border-color .2s,transform .2s}a.post-card:hover{border-color:var(--em);transform:translateY(-2px);text-decoration:none}.post-tag{display:inline-block;font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.8px;padding:.2rem .6rem;border-radius:999px;margin-bottom:.6rem}.post-tag.seeker{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);color:var(--em)}.post-tag.employer{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:var(--gold)}.post-tag.market{background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);color:var(--purple)}.post-tag.tips{background:rgba(236,72,153,.08);border:1px solid rgba(236,72,153,.2);color:var(--pink)}.post-title{font-size:1.15rem;font-weight:800;color:var(--text);margin-bottom:.35rem;line-height:1.3}.post-date{font-size:.72rem;color:var(--text3);font-weight:500;display:block;margin-bottom:.65rem}.empty-state{text-align:center;padding:4rem 2rem;color:var(--text3);font-size:.9rem}.blog-cta{text-align:center;padding:2rem;margin-top:1rem}.blog-cta a{display:inline-block;padding:.6rem 1.5rem;background:linear-gradient(135deg,var(--em),#14b8a6);color:#fff;border-radius:999px;font-size:.85rem;font-weight:700;text-decoration:none}.blog-tab{padding:.35rem .85rem;border-radius:999px;font-size:.75rem;font-weight:600;border:1px solid rgba(255,255,255,.1);background:none;color:#a1a1aa;cursor:pointer;font-family:inherit;transition:all .2s}.blog-tab:hover,.blog-tab.active{background:rgba(16,185,129,.08);border-color:rgba(16,185,129,.3);color:#10b981}.breadcrumb{font-size:.78rem;color:var(--text3);margin-bottom:1rem}.breadcrumb a{color:var(--text3)}.breadcrumb a:hover{color:var(--em)}.single-body{font-size:.95rem;color:var(--text2);line-height:1.9}.single-body p{margin-bottom:1.25rem}.related-posts{margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border)}.related-posts h3{font-size:.88rem;font-weight:700;color:var(--text3);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.5px}.related-card{display:block;padding:.75rem 1rem;border:1px solid var(--border);border-radius:var(--r);margin-bottom:.5rem;text-decoration:none;color:var(--text);transition:border-color .2s}.related-card:hover{border-color:var(--em);text-decoration:none}.related-card h4{font-size:.85rem;font-weight:700;margin-bottom:.15rem}.related-card span{font-size:.72rem;color:var(--text3)}@media(max-width:600px){.top-bar{padding:.75rem 1rem}.blog-header{padding:2rem 1rem 1.5rem}.blog-header h1{font-size:1.4rem}.posts{padding:0 1rem 2rem}.post-card{padding:1.15rem}}';

var BLOG_NAV = '<nav class="top-bar"><a class="top-logo" href="/">FindMe<span>AJob</span></a><div class="top-links"><a href="/">Find Jobs</a><a href="/challenge">#cvchallengenz</a><a href="/blog">Blog</a><a href="/employer-portal.html">Employers</a></div></nav>';

var BLOG_FOOTER = '<footer style="text-align:center;padding:1.5rem;font-size:.72rem;color:var(--text3);border-top:1px solid var(--border);margin-top:1rem"><p>&copy; 2026 FindMeAJob.co.nz &mdash; AI-powered job matching for Aotearoa New Zealand</p><p style="margin-top:.35rem"><a href="/">Home</a> &bull; <a href="/blog">Blog</a> &bull; <a href="/challenge">#cvchallengenz</a> &bull; <a href="/employer-portal.html">Employers</a></p></footer>';

function bEsc(s) { return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function makeSlug(title) { return (title||"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").substring(0,60); }
function xmlEsc(s) { return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;"); }

var BLOG_GRADS = {seeker:"linear-gradient(135deg,#059669,#10b981)",employer:"linear-gradient(135deg,#d97706,#f59e0b)",market:"linear-gradient(135deg,#7c3aed,#8b5cf6)",tips:"linear-gradient(135deg,#db2777,#ec4899)"};

async function getBlogPosts() {
  var posts = [];
  try { if (getKV()) { var raw = await hget("stats", "blog-posts"); posts = raw ? JSON.parse(raw) : []; } } catch(e) { posts = []; }
  return posts;
}

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

  // GET ?blogPost=slug — individual blog post page (SEO)
  if (req.query && req.query.blogPost) {
    var slug = req.query.blogPost;
    var bpPosts = await getBlogPosts();
    var post = null; var postIdx = -1;
    for (var i = 0; i < bpPosts.length; i++) {
      if (makeSlug(bpPosts[i].title) === slug) { post = bpPosts[i]; postIdx = i; break; }
    }
    if (!post) {
      return res.status(200).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0;url=/blog"><title>Redirecting...</title></head><body><a href="/blog">Go to blog</a></body></html>');
    }
    var t = bEsc(post.title);
    var ex = bEsc(post.excerpt);
    var bd = bEsc(post.body).replace(/\n\n/g,"</p><p>").replace(/\n/g,"<br>");
    var dt = bEsc(post.date);
    var ic = (post.icon||"").replace(/</g,"&lt;");
    var tc = post.category||"market";
    var tl = post.categoryLabel||post.category||"Insight";
    var gr = BLOG_GRADS[tc]||BLOG_GRADS.market;
    var imgId = post.imageId||(postIdx*37+100);
    var imgUrl = "https://picsum.photos/seed/"+imgId+"/1200/630";
    var postUrl = "https://www.findmeajob.co.nz/blog/"+slug;
    var readMin = Math.ceil(((post.body||"").length||100)/1000);
    // Related posts: same category first, then others, max 3
    var related = [];
    for (var ri = 0; ri < bpPosts.length && related.length < 3; ri++) {
      if (ri !== postIdx && (bpPosts[ri].category||"market") === tc) related.push(bpPosts[ri]);
    }
    for (var ri2 = 0; ri2 < bpPosts.length && related.length < 3; ri2++) {
      if (ri2 !== postIdx && related.indexOf(bpPosts[ri2]) === -1) related.push(bpPosts[ri2]);
    }
    var relHtml = "";
    if (related.length) {
      relHtml = '<div class="related-posts"><h3>Related Articles</h3>';
      related.forEach(function(rp) {
        var rs = makeSlug(rp.title);
        relHtml += '<a class="related-card" href="/blog/'+rs+'"><h4>'+bEsc(rp.title)+'</h4><span>'+bEsc(rp.date)+' &bull; '+bEsc(rp.categoryLabel||rp.category||"Insight")+'</span></a>';
      });
      relHtml += '</div>';
    }
    var schemaPost = '{"@context":"https://schema.org","@type":"BlogPosting","headline":"'+t.replace(/"/g,'\\"')+'","description":"'+ex.replace(/"/g,'\\"')+'","datePublished":"'+dt+'","dateModified":"'+dt+'","image":"'+imgUrl+'","url":"'+postUrl+'","author":{"@type":"Organization","name":"FindMeAJob.co.nz","url":"https://www.findmeajob.co.nz"},"publisher":{"@type":"Organization","name":"FindMeAJob.co.nz","url":"https://www.findmeajob.co.nz","logo":{"@type":"ImageObject","url":"https://www.findmeajob.co.nz/favicon-512.png"}},"mainEntityOfPage":{"@type":"WebPage","@id":"'+postUrl+'"}}';
    var bcSchema = '{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://www.findmeajob.co.nz/"},{"@type":"ListItem","position":2,"name":"Blog","item":"https://www.findmeajob.co.nz/blog"},{"@type":"ListItem","position":3,"name":"'+t.replace(/"/g,'\\"')+'","item":"'+postUrl+'"}]}';
    var singlePage = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">';
    singlePage += '<title>'+t+' | FindMeAJob.co.nz Blog</title>';
    singlePage += '<meta name="description" content="'+ex+'">';
    singlePage += '<meta name="robots" content="index, follow">';
    singlePage += '<link rel="canonical" href="'+postUrl+'">';
    singlePage += '<meta property="og:type" content="article">';
    singlePage += '<meta property="og:url" content="'+postUrl+'">';
    singlePage += '<meta property="og:title" content="'+t+'">';
    singlePage += '<meta property="og:description" content="'+ex+'">';
    singlePage += '<meta property="og:image" content="'+imgUrl+'">';
    singlePage += '<meta property="og:site_name" content="FindMeAJob.co.nz">';
    singlePage += '<meta property="article:published_time" content="'+dt+'">';
    singlePage += '<meta name="twitter:card" content="summary_large_image">';
    singlePage += '<meta name="twitter:title" content="'+t+'">';
    singlePage += '<meta name="twitter:description" content="'+ex+'">';
    singlePage += '<meta name="twitter:image" content="'+imgUrl+'">';
    singlePage += '<link rel="icon" type="image/svg+xml" href="/logo-icon.svg"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">';
    singlePage += '<link rel="alternate" type="application/rss+xml" title="FindMeAJob.co.nz Blog" href="/blog/rss">';
    singlePage += '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">';
    singlePage += '<script type="application/ld+json">'+schemaPost+'<\/script>';
    singlePage += '<script type="application/ld+json">'+bcSchema+'<\/script>';
    singlePage += '<style>'+BLOG_CSS+'</style></head><body>';
    singlePage += BLOG_NAV;
    singlePage += '<main class="posts" style="padding-top:1.5rem"><div class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/blog">Blog</a> &rsaquo; '+tl+'</div>';
    singlePage += '<article itemscope itemtype="https://schema.org/BlogPosting">';
    singlePage += '<div style="position:relative;height:280px;border-radius:var(--rl);margin-bottom:1.5rem;overflow:hidden"><img src="https://picsum.photos/seed/'+imgId+'/800/400" alt="'+t+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.style.display=\'none\';this.parentElement.style.background=\''+gr+'\'">';
    singlePage += '<div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.75) 0%,transparent 40%)"></div>';
    singlePage += '<div style="position:absolute;bottom:1.25rem;left:1.25rem;display:flex;align-items:center;gap:.75rem"><span style="font-size:2.5rem">'+ic+'</span><div><div class="post-tag '+tc+'" style="background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.3);color:#fff">'+tl+'</div></div></div></div>';
    singlePage += '<meta itemprop="image" content="'+imgUrl+'">';
    singlePage += '<h1 itemprop="headline" style="font-size:1.6rem;font-weight:900;line-height:1.3;margin-bottom:.75rem">'+t+'</h1>';
    singlePage += '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem;font-size:.78rem;color:var(--text3);font-weight:500;flex-wrap:wrap"><span itemprop="author" itemscope itemtype="https://schema.org/Organization"><span itemprop="name">FindMeAJob.co.nz</span></span><span>&bull;</span><time itemprop="datePublished" datetime="'+dt+'">'+dt+'</time><span>&bull;</span><span>'+readMin+' min read</span></div>';
    singlePage += '<p itemprop="description" style="font-size:1.05rem;color:var(--text);line-height:1.7;margin-bottom:1.5rem;font-weight:500;border-left:3px solid var(--em);padding-left:1rem">'+ex+'</p>';
    singlePage += '<div itemprop="articleBody" class="single-body"><p>'+bd+'</p></div>';
    singlePage += '<meta itemprop="publisher" content="FindMeAJob.co.nz">';
    singlePage += '</article>';
    singlePage += relHtml;
    singlePage += '</main>';
    singlePage += '<div class="blog-cta"><a href="/">Find your next NZ job with AI &rarr;</a></div>';
    singlePage += BLOG_FOOTER;
    singlePage += '</body></html>';
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1200");
    return res.status(200).send(singlePage);
  }

  // GET ?blogRss=1 — RSS feed
  if (req.query && req.query.blogRss === "1") {
    var rssPosts = await getBlogPosts();
    var rssItems = "";
    rssPosts.slice(0, 20).forEach(function(p) {
      var s = makeSlug(p.title);
      var imgId = p.imageId||100;
      rssItems += '<item><title>'+xmlEsc(p.title)+'</title>';
      rssItems += '<link>https://www.findmeajob.co.nz/blog/'+s+'</link>';
      rssItems += '<guid>https://www.findmeajob.co.nz/blog/'+s+'</guid>';
      rssItems += '<description>'+xmlEsc(p.excerpt)+'</description>';
      rssItems += '<pubDate>'+new Date(p.date||Date.now()).toUTCString()+'</pubDate>';
      rssItems += '<enclosure url="https://picsum.photos/seed/'+imgId+'/800/400" type="image/jpeg" length="0"/>';
      rssItems += '</item>';
    });
    var rss = '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>';
    rss += '<title>FindMeAJob.co.nz Blog</title><link>https://www.findmeajob.co.nz/blog</link>';
    rss += '<description>Daily insights on the NZ job market for job seekers and employers.</description>';
    rss += '<language>en-nz</language>';
    rss += '<atom:link href="https://www.findmeajob.co.nz/blog/rss" rel="self" type="application/rss+xml"/>';
    rss += rssItems+'</channel></rss>';
    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=600, stale-while-revalidate=1200");
    return res.status(200).send(rss);
  }

  // GET ?sitemap=1 — dynamic sitemap with blog posts
  if (req.query && req.query.sitemap === "1") {
    var smPosts = await getBlogPosts();
    var smXml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    smXml += '<url><loc>https://www.findmeajob.co.nz/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>';
    smXml += '<url><loc>https://www.findmeajob.co.nz/blog</loc><changefreq>daily</changefreq><priority>0.8</priority></url>';
    smXml += '<url><loc>https://www.findmeajob.co.nz/challenge</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>';
    smXml += '<url><loc>https://www.findmeajob.co.nz/employer-portal.html</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>';
    smPosts.forEach(function(p) {
      var s = makeSlug(p.title);
      var lm = p.date || new Date().toISOString().split("T")[0];
      smXml += '<url><loc>https://www.findmeajob.co.nz/blog/'+xmlEsc(s)+'</loc><lastmod>'+xmlEsc(lm)+'</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>';
    });
    smXml += '</urlset>';
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).send(smXml);
  }

  // GET ?blogPage=1 — server-rendered blog listing HTML
  if (req.query && req.query.blogPage === "1") {
    var bPosts = await getBlogPosts();
    var bHtml = "";
    var bSchema = [];
    if (bPosts.length) {
      bPosts.forEach(function(p, idx) {
        var slug = makeSlug(p.title);
        var tc = p.category||"market";
        var tl = p.categoryLabel||p.category||"Insight";
        var t = bEsc(p.title);
        var ex = bEsc(p.excerpt);
        var dt = bEsc(p.date);
        var ic = (p.icon||"").replace(/</g,"&lt;");
        var gr = BLOG_GRADS[tc]||BLOG_GRADS.market;
        var imgId = p.imageId||(idx*37+100);
        var postUrl = "https://www.findmeajob.co.nz/blog/"+slug;
        bHtml += '<a class="post-card" href="/blog/'+slug+'" data-cat="'+tc+'" itemscope itemtype="https://schema.org/BlogPosting">';
        bHtml += '<div style="position:relative;height:200px;border-radius:var(--rl) var(--rl) 0 0;margin:-1.5rem -1.5rem 1rem;display:flex;align-items:flex-end;overflow:hidden"><img src="https://picsum.photos/seed/'+imgId+'/800/400" alt="'+t+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.style.background=\''+gr+'\'">';
        bHtml += '<div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.75) 0%,transparent 50%)"></div>';
        bHtml += '<div style="position:relative;padding:1.25rem;display:flex;align-items:center;gap:.75rem;width:100%">';
        bHtml += '<span style="font-size:2rem" role="img">'+ic+'</span>';
        bHtml += '<div><div class="post-tag '+tc+'" style="margin-bottom:.2rem;background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.3);color:#fff">'+tl+'</div>';
        bHtml += '<time class="post-date" itemprop="datePublished" style="color:rgba(255,255,255,.6)">'+dt+'</time></div>';
        bHtml += '</div></div>';
        bHtml += '<meta itemprop="image" content="https://picsum.photos/seed/'+imgId+'/800/400">';
        bHtml += '<h2 class="post-title" itemprop="headline">'+t+'</h2>';
        bHtml += '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem;font-size:.75rem;color:var(--text3);font-weight:500"><span itemprop="author">FindMeAJob.co.nz</span><span>&bull;</span><time itemprop="datePublished" datetime="'+dt+'">'+dt+'</time><span>&bull;</span><span>'+Math.ceil(((p.body||"").length||100)/1000)+' min read</span></div>';
        bHtml += '<p itemprop="description" style="font-size:.85rem;color:var(--text2);line-height:1.6">'+ex+'</p>';
        bHtml += '<span style="display:inline-block;margin-top:.6rem;font-size:.78rem;font-weight:600;color:var(--em)">Read more &rarr;</span>';
        bHtml += '<link itemprop="url" href="'+postUrl+'">';
        bHtml += '</a>';
        bSchema.push('{"@type":"BlogPosting","headline":"'+t.replace(/"/g,'\\"')+'","description":"'+ex.replace(/"/g,'\\"')+'","datePublished":"'+dt+'","url":"'+postUrl+'","author":{"@type":"Organization","name":"FindMeAJob.co.nz"},"publisher":{"@type":"Organization","name":"FindMeAJob.co.nz"}}');
      });
    } else { bHtml = '<div class="empty-state">No posts yet. Check back soon!</div>'; }
    var ogImg = bPosts.length && bPosts[0].imageId ? 'https://picsum.photos/seed/'+bPosts[0].imageId+'/1200/630' : 'https://www.findmeajob.co.nz/favicon-512.png';
    var schemaJson = '{"@context":"https://schema.org","@type":"Blog","name":"FindMeAJob.co.nz Blog","description":"Daily insights on the NZ job market.","url":"https://www.findmeajob.co.nz/blog","publisher":{"@type":"Organization","name":"FindMeAJob.co.nz","url":"https://www.findmeajob.co.nz"},"blogPost":['+bSchema.join(",")+']}';
    var page = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">';
    page += '<title>NZ Job Market Blog — Career Tips for Seekers &amp; Employers | FindMeAJob.co.nz</title>';
    page += '<meta name="description" content="Daily insights on the NZ job market, career advice, hiring tips for employers, and job seeker guides. Free resources for Kiwi professionals.">';
    page += '<meta name="robots" content="index, follow">';
    page += '<link rel="canonical" href="https://www.findmeajob.co.nz/blog">';
    page += '<meta property="og:type" content="website"><meta property="og:url" content="https://www.findmeajob.co.nz/blog"><meta property="og:title" content="NZ Job Market Blog — FindMeAJob.co.nz"><meta property="og:description" content="Daily insights on the NZ job market for job seekers and employers."><meta property="og:image" content="'+ogImg+'"><meta property="og:site_name" content="FindMeAJob.co.nz">';
    page += '<meta name="twitter:card" content="summary_large_image">';
    page += '<link rel="alternate" type="application/rss+xml" title="FindMeAJob.co.nz Blog" href="/blog/rss">';
    page += '<link rel="icon" type="image/svg+xml" href="/logo-icon.svg"><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">';
    page += '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">';
    page += '<script type="application/ld+json">'+schemaJson+'<\/script>';
    page += '<style>'+BLOG_CSS+'</style></head><body>';
    page += BLOG_NAV;
    page += '<header class="blog-header"><h1>NZ Job Market Insights</h1><p>Daily tips for job seekers and employers in Aotearoa New Zealand</p>';
    page += '<div style="max-width:400px;margin:1.25rem auto 0;position:relative"><input type="text" id="blog-search" placeholder="Search articles..." oninput="filterBlog()" style="width:100%;padding:.55rem 1rem .55rem 2.2rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:999px;color:#f8fafc;font-family:inherit;font-size:.82rem;outline:none"><span style="position:absolute;left:.85rem;top:50%;transform:translateY(-50%);color:#71717a;font-size:.85rem">&#128269;</span></div>';
    page += '<div style="display:flex;justify-content:center;gap:.4rem;margin-top:.85rem;flex-wrap:wrap"><button class="blog-tab active" onclick="filterCat(this,\'all\')">All</button><button class="blog-tab" onclick="filterCat(this,\'seeker\')">Job Seekers</button><button class="blog-tab" onclick="filterCat(this,\'employer\')">Employers</button><button class="blog-tab" onclick="filterCat(this,\'market\')">Market</button><button class="blog-tab" onclick="filterCat(this,\'tips\')">Tips</button></div>';
    page += '</header><main class="posts" id="blog-posts">'+bHtml+'</main>';
    page += '<div class="blog-cta"><a href="/">Find your next NZ job with AI &rarr;</a></div>';
    page += BLOG_FOOTER;
    page += '<script>var _cat="all";function filterBlog(){var q=(document.getElementById("blog-search").value||"").toLowerCase();var cards=document.querySelectorAll(".post-card");cards.forEach(function(c){var text=c.textContent.toLowerCase();var cat=c.getAttribute("data-cat")||"";var matchQ=!q||text.indexOf(q)!==-1;var matchC=_cat==="all"||cat===_cat;c.style.display=matchQ&&matchC?"block":"none";});}function filterCat(btn,cat){_cat=cat;document.querySelectorAll(".blog-tab").forEach(function(t){t.classList.remove("active");});btn.classList.add("active");filterBlog();}</script>';
    page += '</body></html>';
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
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
