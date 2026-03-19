# 🇳🇿 FindMeAJob.co.nz — How to Deploy (No Coding Needed!)

Follow these steps in order. It takes about 15 minutes.

---

## STEP 1 — Get Your Free Anthropic API Key

1. Go to: https://console.anthropic.com
2. Click "Sign Up" and create a free account
3. Once logged in, click "API Keys" in the left menu
4. Click "Create Key", give it a name like "findmeajob"
5. COPY the key — it looks like: sk-ant-api03-xxxxxx...
6. Save it somewhere safe (like a Notepad file) — you only see it once!

---

## STEP 2 — Get a Free GitHub Account

(Vercel needs this to host your site)

1. Go to: https://github.com
2. Click "Sign Up" and create a free account
3. Verify your email

---

## STEP 3 — Upload Your Project to GitHub

1. Once logged into GitHub, click the "+" button (top right) → "New repository"
2. Name it: findmeajob
3. Set it to "Public"
4. Click "Create repository"
5. On the next page, click "uploading an existing file"
6. Drag and drop ALL the files from the ZIP you downloaded:
   - The folder "api" (with chat.js inside)
   - The folder "public" (with index.html inside)
   - vercel.json
   - package.json
7. Click "Commit changes"

---

## STEP 4 — Deploy to Vercel (Free Hosting)

1. Go to: https://vercel.com
2. Click "Sign Up" → choose "Continue with GitHub"
3. Authorise Vercel to access your GitHub
4. Click "Add New Project"
5. Find "findmeajob" in the list → click "Import"
6. Leave all settings as default
7. Click "Deploy"
8. Wait ~1 minute — Vercel will build your site!

---

## STEP 5 — Add Your Secret API Key

This is the most important step — it keeps your API key hidden and secure.

1. In Vercel, go to your project dashboard
2. Click "Settings" (top menu)
3. Click "Environment Variables" (left menu)
4. Fill in:
   - NAME: ANTHROPIC_API_KEY
   - VALUE: paste your key from Step 1 (sk-ant-api03-xxx...)
5. Click "Save"
6. Go back to your project → click "Deployments"
7. Click the three dots "..." next to the latest deployment → "Redeploy"
8. Wait ~1 minute

---

## STEP 6 — Your Site is Live! 🎉

Vercel gives you a free URL like:
👉 findmeajob.vercel.app

Test it by adding some skills and clicking "Find My NZ Jobs"!

---

## STEP 7 (Optional) — Connect Your Custom Domain

If you own findmeajob.co.nz or want to buy it:

1. Buy the domain at: https://www.domainz.co.nz or https://www.godaddy.com
2. In Vercel → Settings → Domains
3. Type in your domain name → click "Add"
4. Follow the instructions to point your domain to Vercel
   (Usually just changing 2 DNS settings at your domain registrar)

---

## 💰 Cost Summary

| Service | Cost |
|---|---|
| Vercel hosting | FREE |
| GitHub | FREE |
| Anthropic API | ~$0.01–0.05 per job search |
| Domain (.co.nz) | ~$25–40 NZD/year |

The Anthropic API has a free credit tier when you first sign up — enough for hundreds of searches!

---

## ❓ Need Help?

If anything goes wrong, the most common fixes are:
- Make sure the API key in Vercel has no spaces before/after it
- Make sure you redeployed after adding the environment variable
- Check the key starts with "sk-ant-"

Good luck! 🥝
