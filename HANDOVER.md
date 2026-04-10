# FindMeAJob.co.nz — Complete Handover Guide

## What You've Bought

A working AI job matching platform for New Zealand. Users upload their CV, AI matches them to real jobs. Employers can post job listings. You have an admin dashboard to manage everything.

Live at: **findmeajob.co.nz**

---

## Table of Contents

1. [Quick Start — Get It Running](#1-quick-start)
2. [Accounts You Need](#2-accounts-you-need)
3. [Environment Variables](#3-environment-variables)
4. [How the Site Works](#4-how-the-site-works)
5. [Admin Dashboard Guide](#5-admin-dashboard-guide)
6. [Managing Jobs](#6-managing-jobs)
7. [Managing the Blog](#7-managing-the-blog)
8. [Social Media Generator](#8-social-media-generator)
9. [The Challenge Page](#9-the-challenge-page)
10. [File Structure](#10-file-structure)
11. [API Endpoints](#11-api-endpoints)
12. [Database Structure](#12-database-structure)
13. [Making Changes with Claude Code](#13-making-changes-with-claude-code)
14. [Common Tasks](#14-common-tasks)
15. [Costs](#15-costs)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Quick Start

You need four free accounts and about 30 minutes.

### Step 1: GitHub

1. Go to github.com and create an account (or use your existing one)
2. Accept the repo transfer you received
3. You now own the code at `github.com/YOUR-USERNAME/findmeajob`

### Step 2: Upstash (Database)

1. Go to upstash.com and create a free account
2. Click "Create Database"
3. Name it `findmeajob`, select the region closest to NZ (Sydney or similar)
4. Once created, go to the database details page
5. Copy the `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — you need these later

### Step 3: API Keys

**Anthropic (AI):**
1. Go to console.anthropic.com
2. Create an account, add a payment method (pay-as-you-go, about $5-20/month)
3. Go to API Keys, create a new key
4. Copy the key — starts with `sk-ant-`

**Adzuna (Job Listings):**
1. Go to developer.adzuna.com
2. Create a free account
3. You get an App ID and App Key
4. Copy both

### Step 4: Vercel (Hosting)

1. Go to vercel.com and sign up with your GitHub account
2. Click "Add New Project"
3. Import your `findmeajob` repository from GitHub
4. Before deploying, click "Environment Variables"
5. Add each variable from the table in Section 3 below
6. Click "Deploy"
7. Wait about 60 seconds — your site is live on a `.vercel.app` URL

### Step 5: Connect Your Domain

1. In Vercel, go to your project → Settings → Domains
2. Type `findmeajob.co.nz` and click Add
3. Vercel will show you DNS records to add
4. Go to your domain registrar and update the DNS records
5. Wait 5-30 minutes for DNS to propagate
6. Your site is now live at findmeajob.co.nz

---

## 2. Accounts You Need

| Service | Purpose | Cost | URL |
|---------|---------|------|-----|
| GitHub | Code hosting | Free | github.com |
| Vercel | Website hosting | Free (hobby tier) | vercel.com |
| Upstash | Database | Free (10k requests/day) | upstash.com |
| Anthropic | AI (Claude) | ~$5-20/month | console.anthropic.com |
| Adzuna | Job listings | Free | developer.adzuna.com |
| Resend (optional) | Emails | Free (100/day) | resend.com |

**Resend** is optional. Without it, the site works fine — you just won't get email notifications when employers register or when job applications are sent. If you want emails:
1. Go to resend.com, create account
2. Add your domain and verify DNS records
3. Create an API key
4. Add `RESEND_API_KEY` and `ADMIN_EMAIL` to Vercel environment variables

---

## 3. Environment Variables

Add all of these in Vercel → Project → Settings → Environment Variables:

| Variable | Example | Required? |
|----------|---------|-----------|
| `ADMIN_PASSWORD` | `YourSecurePassword123!` | Yes |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-...` | Yes |
| `KV_REST_API_URL` | `https://xyz.upstash.io` | Yes |
| `KV_REST_API_TOKEN` | `AXyz...` | Yes |
| `ADZUNA_APP_ID` | `abc123` | Yes |
| `ADZUNA_APP_KEY` | `def456ghi789` | Yes |
| `CRON_SECRET` | `any-random-string-here` | Yes |
| `RESEND_API_KEY` | `re_abc123...` | Optional |
| `ADMIN_EMAIL` | `you@email.com` | Optional |
| `GOOGLE_CLIENT_ID` | `123...apps.googleusercontent.com` | Optional |

**ADMIN_PASSWORD** is what you use to log into the admin dashboard. Pick something strong.

**CRON_SECRET** can be any random string. It secures the automated weekly job alert emails.

**GOOGLE_CLIENT_ID** is only needed if you want Google sign-in for job seekers. Skip it if you don't need that.

After adding variables, redeploy the site (Vercel → Deployments → click the three dots on the latest → Redeploy).

---

## 4. How the Site Works

### For Job Seekers (homepage — findmeajob.co.nz)

1. User arrives at homepage
2. They can browse live job listings
3. Or they upload their CV (PDF, DOCX, or TXT)
4. AI reads their CV and matches them to relevant NZ jobs
5. Results show matched jobs from both your employer listings AND Adzuna (thousands of aggregated NZ jobs)
6. Users can register to save their profile, get weekly email alerts, and track applications
7. They can apply to jobs directly through the site

### For Employers (findmeajob.co.nz/employer-portal.html)

1. Employer registers with email/password
2. They choose a plan (Free, Basic $29, Pro $79)
3. They post a job listing
4. You approve or reject it in the admin dashboard
5. Approved jobs appear on the homepage
6. Job seekers can apply — employer gets an email with the application

**Note:** During the launch period (until Oct 1, 2026), all plans get 90 days of visibility. You can change this in `admin.js` — look for `launchEnd`.

### Plans

| Plan | Listings | Duration | Features |
|------|----------|----------|----------|
| Free | 1 | 30 days | Basic listing |
| Basic ($29) | 5 | 60 days | Logo, company profile, priority placement |
| Pro ($79) | Unlimited | 90 days | Featured listing, AI matching, everything |

---

## 5. Admin Dashboard Guide

Go to: **findmeajob.co.nz/admin.html**

Log in with your `ADMIN_PASSWORD`.

### Tabs

**Pending** — New job listings waiting for your approval. Click the green tick to approve, red X to reject.

**Live** — Currently active, approved jobs. You can feature/unfeature them, relist, or delete.

**Rejected** — Jobs you rejected. You can still approve them if you change your mind.

**Expired** — Jobs past their plan duration. You can relist to reactivate.

**All** — Every job in the system.

**Job Seekers** — All registered job seekers. Shows name, email, location, whether they uploaded a CV, and their email alert preference. You can delete users.

**Employers** — All registered employers. Shows company, plan, and number of listings. You can change their plan or delete them.

**Social Media** — AI-powered social media post generator (see Section 8).

**Blog** — AI-powered blog content generator (see Section 7).

### Stats Bar

At the top you see:
- Total seekers
- Total employers
- Pending jobs count
- Live jobs count
- CV uploads count

---

## 6. Managing Jobs

### Approving a Job

1. Go to Admin → Pending tab
2. Review the listing (title, company, description)
3. Click the green checkmark to approve
4. The job immediately appears on the homepage
5. The employer gets an email notification

### Rejecting a Job

1. Click the red X
2. The employer gets an email saying their listing was rejected
3. They can edit and resubmit from their portal

### Featuring a Job

Featured jobs appear first in search results with a special badge.
1. Go to the Live tab
2. Click the star icon on any job to toggle featured status

### Relisting an Expired Job

1. Go to the Expired tab
2. Click the relist button
3. The job gets a fresh approval date and goes live again

---

## 7. Managing the Blog

### Generating New Posts

1. Go to Admin → Blog tab
2. Select how many posts (3, 5, or 7)
3. Click "Generate Posts"
4. AI writes SEO-optimised articles about the NZ job market
5. Review each post — you can edit the title, excerpt, and body inline
6. Remove any you don't like by clicking X
7. Click "Publish X Posts to Blog"
8. Posts appear at findmeajob.co.nz/blog within about 60 seconds

### Editing Published Posts

1. Click "View Published" in the Blog tab
2. Click any post to expand the editor
3. Edit the title, excerpt, or body
4. Click "Save Changes"

### Deleting Posts

1. Click "View Published"
2. Click the X button on any post
3. Confirm deletion

### Blog URLs

Each post gets its own SEO-friendly URL:
- Blog listing: `findmeajob.co.nz/blog`
- Individual post: `findmeajob.co.nz/blog/how-to-write-a-cv-in-nz`
- RSS feed: `findmeajob.co.nz/blog/rss`
- Sitemap: `findmeajob.co.nz/sitemap.xml`

---

## 8. Social Media Generator

1. Go to Admin → Social Media tab
2. Choose a **tone** (Funny, Professional, Hype, Casual)
3. Choose a **focus** (Challenge Viral, Platform Promo, Seeker Tips, Employer Tips, Market Insight, etc.)
4. Click "Generate Posts"
5. AI creates one post for each platform: Twitter, LinkedIn, Facebook, Instagram, TikTok, YouTube, Reddit
6. Click **Copy** to copy any post to your clipboard
7. Click **Image** to download a branded image for that platform (correct dimensions per platform)

### Platform Image Sizes

| Platform | Dimensions |
|----------|-----------|
| Twitter/X | 1200 x 675 |
| LinkedIn | 1200 x 627 |
| Facebook | 1200 x 630 |
| Instagram | 1080 x 1080 |
| TikTok | 1080 x 1920 |
| YouTube | 1280 x 720 |
| Reddit | 1200 x 628 |

---

## 9. The Challenge Page

URL: **findmeajob.co.nz/challenge**

This is a viral marketing tool. Users upload their CV and AI suggests funny "career pivots" — like telling an accountant they should be a dog psychologist.

- Users get a shareable result card designed to be screenshotted for TikTok
- Results can be shared via URL links
- A leaderboard tracks the most popular suggested careers
- Every upload increments the CV counter in admin stats

The challenge page works independently from the main job matching. It's designed to drive traffic to the site.

---

## 10. File Structure

```
findmeajob/
  api/
    _kv.js              — Database helper (Upstash Redis)
    admin.js             — Admin dashboard API
    apply.js             — Job application emails
    approved-jobs.js     — Public jobs, blog, sitemap, RSS
    chat.js              — Claude AI proxy
    cron-alerts.js       — Weekly email alerts
    employer-jobs.js     — Employer job management
    jobs.js              — Adzuna job search
    register.js          — Employer registration/login
    reset-password.js    — Password reset flow
    seeker-apps.js       — Application tracking
    seeker.js            — Job seeker profiles/auth
  public/
    index.html           — Main homepage (job seekers)
    employer-portal.html — Employer dashboard
    admin.html           — Admin panel
    challenge.html       — Viral CV challenge
    blog.html            — Blog (unused — blog is server-rendered)
    logo-icon.svg        — Site logo
    robots.txt           — SEO crawling rules
    site.webmanifest     — PWA manifest
    favicon-*.png        — Favicons (various sizes)
  vercel.json            — Routes and deployment config
  package.json           — Project metadata
```

---

## 11. API Endpoints

| Endpoint | Method | What It Does |
|----------|--------|--------------|
| `/api/chat` | POST | Send messages to Claude AI |
| `/api/jobs` | POST | Search Adzuna for NZ jobs |
| `/api/register` | POST | Employer register/login |
| `/api/apply` | POST | Send job application email |
| `/api/admin` | POST | Admin operations (approve, reject, etc.) |
| `/api/approved-jobs` | GET/POST | Public job list, blog, sitemap, tracking |
| `/api/employer-jobs` | GET/POST | Employer job management |
| `/api/seeker` | GET/POST | Job seeker profiles |
| `/api/seeker-apps` | POST | Application tracking |
| `/api/reset-password` | POST | Password reset |
| `/api/cron-alerts` | GET/POST | Weekly job alert emails |

---

## 12. Database Structure

The database is Upstash Redis. Data is stored in hashes:

**`employers`** — One entry per employer email
- Fields: id, name, company, email, password, plan, phone, website, registered

**`jobs`** — One entry per job ID
- Fields: id, ref, title, company, location, description, status (pending/approved/rejected), plan, views, applies, submitted, approvedAt

**`seekers`** — One entry per seeker email
- Fields: id, name, email, password, phone, location, cvText, cvFileName, emailAlerts, createdAt

**`applications`** — One entry per seeker email (array of applications)

**`stats`** — Counters and blog data
- `cv-uploads` — counter
- `leaderboard` — JSON object of career titles and counts
- `blog-posts` — JSON array of all blog posts

---

## 13. Making Changes with Claude Code

Claude Code is an AI coding tool that can read, edit, and deploy your codebase. It's the tool that built this entire platform.

### Getting Started

1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`
2. Navigate to your project folder: `cd findmeajob`
3. Run: `claude`
4. You're now in an AI coding session

### Example Tasks You Can Ask

**Change the site design:**
```
"Change the primary colour from green to blue"
"Make the hero section text bigger"
"Add a dark/light mode toggle"
```

**Modify features:**
```
"Change the employer plans — make Basic $19 instead of $29"
"Add a salary filter to the job search"
"Remove the registration requirement for job seekers"
```

**Content changes:**
```
"Update the About section text"
"Change the footer links"
"Add a new page at /pricing"
```

**Fix issues:**
```
"The login page shows an error when I enter the wrong password"
"Jobs are not showing up on the homepage"
"The blog images are broken"
```

### Important Rules for This Codebase

When using Claude Code (or editing manually), keep these in mind:

1. **No build step** — Everything is vanilla JavaScript. No React, no webpack. Just edit the files and deploy.

2. **CommonJS only in API files** — Use `var x = require("./module")` not `import`. Use `module.exports` not `export default`.

3. **No apostrophes in JavaScript strings** — Write `"do not"` not `"don't"`. Apostrophes in single-quoted strings cause syntax errors in the server-rendered HTML.

4. **Vercel has a 12 serverless function limit** on the free tier — Currently at 11/12. If you need a new API endpoint, add it to an existing file rather than creating a new one.

5. **Test before deploying** — Vercel auto-deploys from your main branch. If you push broken code, the site goes down. Use a separate branch for testing.

### Deploying Changes

**Option A: Push to GitHub (auto-deploys)**
```bash
git add .
git commit -m "describe your change"
git push origin main
```
Vercel automatically deploys when you push to main. Takes about 60 seconds.

**Option B: Vercel CLI**
```bash
npm install -g vercel
vercel --prod
```

### Using Claude Code to Deploy

You can ask Claude Code to commit and push for you:
```
"Commit these changes and push to main"
```

It will stage the files, write a commit message, and push — which triggers a Vercel deployment.

---

## 14. Common Tasks

### Change the Admin Password

1. Go to Vercel → Project → Settings → Environment Variables
2. Edit `ADMIN_PASSWORD`
3. Redeploy

### Add a New Job Manually (Without Employer Portal)

Currently there's no way to add jobs directly from admin. Employers must submit through the portal. If you want to add this feature, ask Claude Code:
```
"Add an 'Add Job' button to the admin dashboard that lets me create a job listing directly"
```

### Export Your Data

The database is on Upstash. To export:
1. Go to upstash.com → your database
2. Use the CLI tab to run: `HGETALL jobs`, `HGETALL seekers`, `HGETALL employers`
3. Or ask Claude Code: "Write a script to export all data from Upstash to a JSON file"

### Change Employer Pricing

Edit `public/index.html` — search for "pricing" to find the pricing section. The actual plan limits are in `api/employer-jobs.js` — search for `planLimits`.

### Stop the Weekly Email Alerts

Remove or comment out the cron entry in `vercel.json`:
```json
"crons": []
```

---

## 15. Costs

### Monthly Breakdown

| Service | Free Tier Limit | Typical Cost |
|---------|----------------|--------------|
| Vercel | 100GB bandwidth | Free |
| Upstash | 10,000 requests/day | Free |
| Anthropic | Pay per use | $5-20/month |
| Adzuna | Unlimited | Free |
| Resend | 100 emails/day | Free |
| Domain | N/A | ~$25/year |

**Total: $5-20/month** depending on how many people use the AI features.

The Anthropic cost scales with usage. Each CV match or blog generation uses about $0.01-0.05 in API calls. At 100 users/day, expect about $5-10/month.

### Scaling

If the site gets popular (thousands of users/day):
- Vercel: upgrade to Pro ($20/month) for more bandwidth
- Upstash: upgrade to Pay-as-you-go ($0.20 per 100K requests)
- Anthropic: costs scale linearly with usage

---

## 16. Troubleshooting

### Site shows "500 Internal Server Error"

- Check Vercel → Project → Deployments → click the failed deployment → check logs
- Usually a missing environment variable. Make sure all required ones are set.

### AI matching/blog/social media not working

- Check your Anthropic API key is valid and has credit
- Go to console.anthropic.com → check your balance

### Jobs not showing up

- Make sure Adzuna API keys are set
- Check the admin dashboard — are jobs stuck in "Pending"? Approve them.

### Blog page is empty

- Did you publish posts? Go to Admin → Blog → check "View Published"
- Blog page has a 60-second cache. Wait a minute and refresh.

### Emails not sending

- Resend API key might be missing or invalid
- Check resend.com dashboard for delivery logs
- The site works without emails — they're just notifications

### Domain not connecting

- DNS changes can take up to 48 hours (usually 5-30 minutes)
- Check Vercel → Settings → Domains for error messages
- Make sure you added the correct DNS records at your registrar

### Need help?

If you're stuck, open the project in Claude Code and describe your problem. It can read the code, diagnose issues, and fix them for you.

---

## Support

You have 7 days of email support from the seller. After that, use Claude Code — it built this entire platform and knows how everything works.

Good luck with FindMeAJob.co.nz!
