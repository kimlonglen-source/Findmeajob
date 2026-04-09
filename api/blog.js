var _kv = require("./_kv");
var getKV = _kv.getKV;
var hget = _kv.hget;

module.exports = async function handler(req, res) {
  var posts = [];
  try {
    if (getKV()) {
      var raw = await hget("stats", "blog-posts");
      posts = raw ? JSON.parse(raw) : [];
    }
  } catch(e) { posts = []; }

  var postsHtml = "";
  var schemaItems = [];

  if (posts.length) {
    posts.forEach(function(p) {
      var slug = (p.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 60);
      var tagClass = p.category || "market";
      var tagLabel = p.categoryLabel || p.category || "Insight";
      var safeTitle = (p.title || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
      var safeExcerpt = (p.excerpt || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      var safeBody = (p.body || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
      var safeDate = (p.date || "").replace(/</g,"&lt;");
      var safeIcon = (p.icon || "📝").replace(/</g,"&lt;");
      var gradients = {seeker:"linear-gradient(135deg,#059669,#10b981)",employer:"linear-gradient(135deg,#d97706,#f59e0b)",market:"linear-gradient(135deg,#7c3aed,#8b5cf6)",tips:"linear-gradient(135deg,#db2777,#ec4899)"};
      var grad = gradients[tagClass] || gradients.market;

      var imgId = p.imageId || (schemaItems.length * 37 + 100);

      postsHtml += '<article class="post-card" id="' + slug + '" itemscope itemtype="https://schema.org/BlogPosting">';
      postsHtml += '<div style="position:relative;height:200px;background:url(https://picsum.photos/seed/' + imgId + '/800/400) center/cover,' + grad + ';border-radius:var(--rl) var(--rl) 0 0;margin:-1.5rem -1.5rem 1rem;display:flex;align-items:flex-end;overflow:hidden">';
      postsHtml += '<div style="position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.75) 0%,transparent 50%)"></div>';
      postsHtml += '<div style="position:relative;padding:1.25rem;display:flex;align-items:center;gap:.75rem;width:100%">';
      postsHtml += '<span style="font-size:2rem" role="img">' + safeIcon + '</span>';
      postsHtml += '<div><div class="post-tag ' + tagClass + '" style="margin-bottom:.2rem;background:rgba(255,255,255,.2);border-color:rgba(255,255,255,.3);color:#fff">' + tagLabel + '</div>';
      postsHtml += '<time class="post-date" itemprop="datePublished" style="color:rgba(255,255,255,.6)">' + safeDate + '</time></div>';
      postsHtml += '</div></div>';
      postsHtml += '<meta itemprop="image" content="https://picsum.photos/seed/' + imgId + '/800/400">';
      postsHtml += '<h2 class="post-title" itemprop="headline">' + safeTitle + '</h2>';
      postsHtml += '<p itemprop="description" style="font-size:.88rem;color:var(--text2);line-height:1.7;margin-bottom:.75rem">' + safeExcerpt + '</p>';
      postsHtml += '<div itemprop="articleBody" style="font-size:.88rem;color:var(--text2);line-height:1.8"><p>' + safeBody + '</p></div>';
      postsHtml += '<meta itemprop="author" content="FindMeAJob.co.nz">';
      postsHtml += '<meta itemprop="publisher" content="FindMeAJob.co.nz">';
      postsHtml += '</article>';

      schemaItems.push('{"@type":"BlogPosting","headline":"' + safeTitle.replace(/"/g, '\\"') + '","description":"' + safeExcerpt.replace(/"/g, '\\"') + '","datePublished":"' + safeDate + '","author":{"@type":"Organization","name":"FindMeAJob.co.nz"},"publisher":{"@type":"Organization","name":"FindMeAJob.co.nz"}}');
    });
  } else {
    postsHtml = '<div class="empty-state">No posts yet. Check back soon!</div>';
  }

  var schema = '{"@context":"https://schema.org","@type":"Blog","name":"FindMeAJob.co.nz Blog","description":"Daily insights on the NZ job market, career advice for job seekers, and hiring tips for employers.","url":"https://www.findmeajob.co.nz/blog","publisher":{"@type":"Organization","name":"FindMeAJob.co.nz","url":"https://www.findmeajob.co.nz","logo":{"@type":"ImageObject","url":"https://www.findmeajob.co.nz/favicon-512.png"}},"blogPost":[' + schemaItems.join(",") + ']}';

  var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>NZ Job Market Blog — Career Tips for Seekers &amp; Employers | FindMeAJob.co.nz</title>\n<meta name="description" content="Daily insights on the NZ job market, career advice, hiring tips for employers, and job seeker guides. Free AI-powered job matching for New Zealand.">\n<meta name="robots" content="index, follow">\n<link rel="canonical" href="https://www.findmeajob.co.nz/blog">\n<meta property="og:type" content="website">\n<meta property="og:url" content="https://www.findmeajob.co.nz/blog">\n<meta property="og:title" content="NZ Job Market Blog — FindMeAJob.co.nz">\n<meta property="og:description" content="Daily insights on the NZ job market for job seekers and employers.">\n<meta property="og:image" content="https://www.findmeajob.co.nz/favicon-512.png">\n<link rel="icon" type="image/svg+xml" href="/logo-icon.svg">\n<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">\n<script type="application/ld+json">' + schema + '</script>\n<style>\n:root{--bg:#09090b;--bg2:rgba(255,255,255,.03);--text:#f8fafc;--text2:#a1a1aa;--text3:#71717a;--em:#10b981;--purple:#8b5cf6;--pink:#ec4899;--gold:#f59e0b;--border:rgba(255,255,255,.06);--border2:rgba(255,255,255,.1);--r:12px;--rl:20px}\n*{margin:0;padding:0;box-sizing:border-box}\nbody{background:var(--bg);color:var(--text);font-family:"Inter",system-ui,sans-serif;min-height:100vh;font-size:15px;line-height:1.6}\na{color:var(--em);text-decoration:none}\na:hover{text-decoration:underline}\n.top-bar{display:flex;align-items:center;justify-content:space-between;padding:1rem 2rem;border-bottom:1px solid var(--border)}\n.top-logo{font-size:.95rem;font-weight:800;color:var(--text);text-decoration:none}\n.top-logo span{color:var(--em)}\n.top-logo:hover{text-decoration:none}\n.top-links{display:flex;gap:1rem;font-size:.82rem;font-weight:600}\n.top-links a{color:var(--text2)}\n.top-links a:hover{color:var(--text)}\n.blog-header{text-align:center;padding:3rem 2rem 2rem}\n.blog-header h1{font-size:1.8rem;font-weight:900;margin-bottom:.35rem}\n.blog-header p{color:var(--text2);font-size:.9rem;max-width:500px;margin:0 auto}\n.posts{max-width:720px;margin:0 auto;padding:0 1.5rem 3rem}\n.post-card{border:1px solid var(--border);border-radius:var(--rl);padding:1.5rem;margin-top:1.25rem;background:var(--bg2)}\n.post-tag{display:inline-block;font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.8px;padding:.2rem .6rem;border-radius:999px;margin-bottom:.6rem}\n.post-tag.seeker{background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);color:var(--em)}\n.post-tag.employer{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);color:var(--gold)}\n.post-tag.market{background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);color:var(--purple)}\n.post-tag.tips{background:rgba(236,72,153,.08);border:1px solid rgba(236,72,153,.2);color:var(--pink)}\n.post-title{font-size:1.15rem;font-weight:800;color:var(--text);margin-bottom:.35rem;line-height:1.3}\n.post-date{font-size:.72rem;color:var(--text3);font-weight:500;display:block;margin-bottom:.65rem}\n.empty-state{text-align:center;padding:4rem 2rem;color:var(--text3);font-size:.9rem}\n.blog-cta{text-align:center;padding:2rem;margin-top:1rem}\n.blog-cta a{display:inline-block;padding:.6rem 1.5rem;background:linear-gradient(135deg,var(--em),#14b8a6);color:#fff;border-radius:999px;font-size:.85rem;font-weight:700;text-decoration:none}\n.blog-cta a:hover{text-decoration:none;transform:translateY(-2px)}\n@media(max-width:600px){.top-bar{padding:.75rem 1rem}.blog-header{padding:2rem 1rem 1.5rem}.blog-header h1{font-size:1.4rem}.posts{padding:0 1rem 2rem}.post-card{padding:1.15rem}}\n</style>\n</head>\n<body>\n<nav class="top-bar">\n<a class="top-logo" href="/">FindMe<span>AJob</span></a>\n<div class="top-links">\n<a href="/">Find Jobs</a>\n<a href="/challenge">#cvchallengenz</a>\n<a href="/employer-portal.html">Employers</a>\n</div>\n</nav>\n<header class="blog-header">\n<h1>NZ Job Market Insights</h1>\n<p>Daily tips for job seekers and employers in Aotearoa New Zealand</p>\n</header>\n<main class="posts">' + postsHtml + '</main>\n<div class="blog-cta">\n<a href="/">Find your next NZ job with AI &rarr;</a>\n</div>\n<footer style="text-align:center;padding:1.5rem;font-size:.72rem;color:var(--text3);border-top:1px solid var(--border);margin-top:1rem">\n<p>&copy; 2026 FindMeAJob.co.nz — AI-powered job matching for Aotearoa New Zealand</p>\n<p style="margin-top:.35rem"><a href="/">Home</a> &bull; <a href="/blog">Blog</a> &bull; <a href="/challenge">#cvchallengenz</a> &bull; <a href="/employer-portal.html">Employers</a></p>\n</footer>\n</body>\n</html>';

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
  return res.status(200).send(html);
};
