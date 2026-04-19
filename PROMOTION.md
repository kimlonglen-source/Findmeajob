# FindMeAJob.co.nz — Promotion Plan

Free AI career tools for NZ: CV matching, interview practice, CV/cover-letter writing, 12+ free tools, niche landing pages (trades, healthcare, newcomers, graduates).

---

## 1. Pick the wedge (weeks 1–2)

Don't promote "the site" — promote **one page per audience** and let each page carry its own channel. Existing niche pages already do the work:

| Audience | Landing page | Best channel |
|---|---|---|
| Tradies | `/trades` + `/trades/builder`, `/trades/electrician`, `/trades/plumber`, `/trades/mechanic`, `/trades/apprentice` | Facebook groups, TradeMe Jobs comments, local Reddit |
| Healthcare | `/healthcare` + `/healthcare/rn`, `/hca`, `/midwife`, `/allied-health` | NZNO / union FB groups, Reddit r/newzealand |
| New migrants | `/newcomers` | NZ immigration FB groups, Settlement NZ partners |
| Graduates | `/graduates` | University careers offices, StudentJobSearch, TikTok |

One page = one hook = one ad creative. Pages you already have with hero photos convert better than the homepage for cold traffic.

## 2. SEO (the cheapest channel, but slowest)

- **Programmatic blog**: `/blog/*` is already wired through `api/approved-jobs.js`. Ship 2 posts/week targeting long-tail NZ queries: *"how to write a CV for a builder in NZ"*, *"RN interview questions New Zealand"*, *"moving to NZ for work visa"*. Each post links to the matching niche page.
- **Internal linking**: every niche page already cross-links — keep it. Add breadcrumb schema if not there.
- **Sitemap**: already live at `/sitemap.xml`. Submit to Google Search Console + Bing Webmaster on day one.
- **Target 0-competition keywords first**: `"hca interview questions nz"`, `"sparkie apprentice cv template"`. Ahrefs free keyword tool or Google autocomplete is enough.

## 3. Paid acquisition (if budget allows — $200–500 test)

- **Meta ads** targeting NZ, age 18–55, interests = trades/healthcare/migration. Creative = 15-sec video of the AI interview sim in action. Send to the matching niche page, not home.
- **Google Search** only bid on `"cv builder nz free"`, `"interview practice nz"`. Avoid `"jobs nz"` — Seek will burn your wallet.
- **TikTok organic before paid**: 3 videos/week of screen-recorded AI interview practice, captioned. Cheaper than ads and the interview-sim is genuinely novel content.

## 4. Partnerships (highest leverage, $0)

- **Universities**: email careers offices at Auckland, AUT, Vic, Canterbury, Otago, Waikato, Massey. Offer them `/graduates` as a free resource for their students. One yes = thousands of visits per semester.
- **WINZ / MSD caseworkers**: the tool is free and NZ-focused. A pilot with one regional office could drive sustained referral traffic.
- **Migrant settlement orgs**: Red Cross Pathways to Employment, Settlement NZ, Auckland Regional Migrant Services. Pitch `/newcomers`.
- **Union newsletters**: E tū, NZNO, PSA. Free tool for members = easy inclusion.
- **Industry training orgs**: BCITO (building), Connexis (infra), Careerforce (healthcare). Same pitch.

## 5. Community (slow but sticky)

- Answer questions on **Reddit r/newzealand, r/auckland, r/wellington** when CV/interview topics come up. Don't drop links — mention the free tool only if asked. Mods ban promoters fast.
- **Facebook groups**: "NZ Jobs", "Kiwis in Australia Coming Home", "New to NZ", trade-specific groups. Same rule — be useful first.
- **LinkedIn**: post weekly from the owner's personal account about NZ job market stats (use your admin data as source). Tag /match or /interview-sim at the end.

## 6. Press & credibility

- Pitch Stuff, NZ Herald tech columns, RNZ "The Detail" — angle: *"Free NZ-built AI replaces $200 career coaches"*. One story = lasting SEO backlinks.
- Submit to NZ startup directories: **Startup Genome NZ**, **Angel NZ**, **Product Hunt NZ**.

## 7. Retention / word of mouth

- **Shareable output**: after match results, add "Share your score" card → drives viral loops.
- **Email alerts** (already scheduled via `/api/cron-alerts` daily at 8pm): keep users warm so they refer friends.
- **Employer side flywheel**: more approved jobs → better SEO → more seekers → more employers. Focus seeker acquisition first; employers follow.

## 8. What to measure

- Search Console: impressions + clicks per niche page.
- Vercel Analytics: top landing pages, bounce per page.
- Upstash: applications submitted per day (revenue proxy).
- Conversion: visits → `/match.html#apply` completions.

## Quick-win checklist (do this week)

- [ ] Submit sitemap to Google Search Console + Bing
- [ ] Email 5 university careers offices with `/graduates` link
- [ ] Post one TikTok screen-recording of `/interview-sim`
- [ ] Add Meta Pixel + Google Analytics to all niche pages
- [ ] Write 2 blog posts targeting zero-competition NZ long-tails
- [ ] DM 3 NZ Reddit mods asking if a free tool post would be allowed
