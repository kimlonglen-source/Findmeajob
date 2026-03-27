# FindMeAJob.co.nz — Claude Code Handoff Brief

## What This Is
A fully built and live AI-powered job board for New Zealand at **www.findmeajob.co.nz**. Built entirely with Claude in claude.ai. Now moving to Claude Code for faster iteration.

## Live Site
- **URL:** https://www.findmeajob.co.nz
- **Admin panel:** https://www.findmeajob.co.nz/admin.html (password: findmeajob2026)
- **Employer portal:** https://www.findmeajob.co.nz/employer-portal.html

## Repository
- **GitHub:** https://github.com/kimlonglen-source/Findmeajob (branch: main)
- **Hosting:** Vercel — project: findmeajob / kimlonglen-5674s
- **Deploy command:** `vercel --prod` from the project folder

## Project Structure
```
public/
  index.html              ← Main SPA (entire site in one file)
  employer-portal.html    ← Employer dashboard (sign in, register, post jobs)
  admin.html              ← Admin panel (approve/reject/manage listings)
  favicon*.png            ← Favicons at all sizes
  site.webmanifest
  logo-icon.svg
api/
  chat.js                 ← Claude AI chat endpoint
  jobs.js                 ← Adzuna live NZ jobs API
  register.js             ← Employer registration
  login.js                ← Employer login
  submit-job.js           ← Job listing submission
  admin.js                ← Admin actions (approve/reject/feature/delete)
  approved-jobs.js        ← Serve approved listings (sorted by plan tier)
  employer-jobs.js        ← Employer portal — fetch/edit own listings
  reset-password.js       ← Password reset via Resend email
  track.js                ← View/apply click tracking
  _kv.js                  ← Upstash KV database helper
  debug.js                ← Debug endpoint
vercel.json               ← Routing config
package.json
```

## Environment Variables (set in Vercel)
```
ANTHROPIC_API_KEY      — Claude AI (job matching, CV analysis)
ADZUNA_APP_ID          — 9f468e01
ADZUNA_APP_KEY         — 615e1222d1dad2d535ea6065c75e1dcb
KV_REST_API_URL        — Upstash database URL
KV_REST_API_TOKEN      — Upstash database token
RESEND_API_KEY         — Email service (password resets)
```

## Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS — single page app in index.html
- **Backend:** Vercel serverless functions (Node.js, CommonJS — no ES modules)
- **Database:** Upstash Redis (KV store) via REST API
- **AI:** Anthropic Claude API (claude-sonnet-4-20250514)
- **Jobs API:** Adzuna NZ
- **Email:** Resend (DNS pending verification on findmeajob.co.nz)
- **Fonts:** Cabinet Grotesk + Fraunces (Google Fonts)

## How the Site Works

### For Job Seekers (free, no account needed)
1. Upload CV (PDF/Word) OR type skills manually
2. Claude AI analyses skills and returns 5 matched NZ job titles with % scores
3. Live Adzuna jobs fetched for each match, scored by AI relevance, sorted
4. Pro employer listings surface in results with gold Featured badge
5. Apply Now modal shows employer email + cover letter guidance

### For Employers
1. Go to /employer-portal.html
2. Register (choose Starter/Growth/Pro plan) or Sign In
3. Post job listing → submitted for admin review
4. Admin approves → listing goes live
5. Pro listings auto-featured, Growth listings priority placement
6. Analytics (views/applies) visible for Growth/Pro

### For Admin
- /admin.html → password: findmeajob2026
- Approve/reject/delete/feature listings
- Pro listings auto-feature on approval

## Employer Plans
| Plan | Price | Listings | Visibility | Features |
|------|-------|----------|------------|---------|
| Starter | $0 forever | 1 | 30 days | Standard placement |
| Growth | $29/mo | 5 | 60 days | Priority + profile + logo + analytics |
| Pro | $79/mo | Unlimited | 90 days | Featured + AI matching + full analytics |

## Database Schema (Upstash KV)
```
employers:{email}     → { id, name, company, email, password, plan, phone, website, resetToken, resetExpiry }
jobs:{jobId}          → { id, employerId, company, email, title, location, category, type, salary,
                          description, requirements, why, companyProfile, logoUrl, plan, planDays,
                          autoFeature, priority, featured, status, submitted, approvedAt, views, applies }
```
- `hgetall('jobs')` → all jobs
- `hget('employers', email)` → one employer
- `hset('employers', email, data)` → save employer

## Key Design Decisions
1. **No npm/webpack** — all vanilla JS, no build step needed
2. **CommonJS only** — all API files use `module.exports`, no `import/export`
3. **No apostrophes in JS strings** — causes syntax errors (use "do not" not "don't")
4. **No HTML entities in JS strings** — causes syntax errors (use `\u2b50` or actual emoji)
5. **Adzuna filtering** — `location0=New+Zealand` param + area[0] check + domain blocklist
6. **Employer flow** — all through /employer-portal.html, not main site

## CSS Design System
```css
--bg:#0a0a08        dark background
--bg2:#111110       cards
--bg3:#181816       inputs
--text:#f2efe8      primary text
--text2:#c8c4bc     secondary text
--text3:#888480     muted text
--em:#10b981        emerald green (primary brand)
--em2:#059669       emerald hover
--em3:#022c22       emerald subtle bg
--gold:#f59e0b      gold (Pro/Featured)
--red:#ef4444       danger
--border:#2a2a28    borders
--card:#141412      card bg
--r:8px             border radius
--rl:14px           large border radius
```
Light mode toggled by `.light` class on body.

## Known Issues / Pending
1. **Resend DNS** — email sending not yet verified. DNS records added to Crazy Domains but propagation pending. Password reset falls back to showing link on screen.
2. **Adzuna NZ filter** — mostly working. `location0=New+Zealand` + area check + domain blocklist. Some overseas jobs may slip through.
3. **Employer plan payments** — no payment processing yet. Plans are self-reported, honour system. Email hello@findmeajob.co.nz to upgrade.

## Domain & DNS (Crazy Domains)
```
A Record:   findmeajob.co.nz      → 216.198.79.1  (Vercel)
A Record:   www.findmeajob.co.nz  → 216.198.79.1  (Vercel)
MX Records: findmeajob.co.nz      → Zoho mail (existing)
MX Record:  send.findmeajob.co.nz → feedback-smtp.us-east-1.amazonses.com (Resend)
TXT:        resend._domainkey      → DKIM value (Resend)
TXT:        send.findmeajob.co.nz → v=spf1 include:amazonses.com ~all (Resend)
```

## What Still Needs Building
1. Payment processing (Stripe) for Growth/Pro plan billing
2. Email notifications to employers when listings are approved/rejected
3. Indeed publisher API integration (alongside Adzuna)
4. Seek.co.nz partner programme integration (contact them directly)
5. Job seeker email alerts ("save this search")
6. Better mobile experience audit
7. Google Search Console — submit sitemap once one is built

## Deployment Process
1. Make changes in project folder
2. Always run `node --check` on any JS before saving
3. `git add . && git commit -m "description" && git push`
4. Vercel auto-deploys from GitHub main branch
5. Check https://www.findmeajob.co.nz after ~60 seconds

## Important: Syntax Rules for This Codebase
The main index.html has all JS inline in a single `<script>` block. Be careful:
- Never use contractions in JS strings (use "do not" not "don't")
- Never use HTML entities like `&#11088;` in JS strings (use `\u2b50` or actual emoji)
- Always run `node --check` on extracted script before deploying
- No `async/await` at top level outside functions
- All API routes must be in vercel.json builds + routes sections

## Contact
- Owner: Kim (kimlonglen-source on GitHub)
- Email: hello@findmeajob.co.nz
- Built with Claude in claude.ai (Sessions 1-3, March 2026)
