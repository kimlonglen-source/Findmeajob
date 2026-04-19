# Auto-deploy to Vercel

`deploy.yml` ships every push to `main` to production and every PR to a preview URL.

## One-time setup

Vercel's native GitHub integration already auto-deploys by default. Use this workflow **instead** of that integration (disable it in Vercel → Project → Settings → Git → "Ignore build step" or disconnect GitHub) so you don't get double deploys.

Add three repo secrets at `Settings → Secrets and variables → Actions`:

| Secret | Where to find it |
|---|---|
| `VERCEL_TOKEN` | https://vercel.com/account/tokens → Create |
| `VERCEL_ORG_ID` | Run `vercel link` locally, then open `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Same file as above |

Quickest way to get the IDs:

```bash
npx vercel link      # pick the findmeajob project
cat .vercel/project.json
```

Copy the `orgId` and `projectId` values into GitHub secrets, then delete the local `.vercel` folder (it's already gitignored via `.gitignore`).

## What it does

- **push to `main`** → production deploy at findmeajob.co.nz
- **pull request** → preview deploy, URL posted as a PR comment
- **manual run** → `workflow_dispatch` button in the Actions tab

Concurrency cancels in-flight runs on the same ref so only the latest commit deploys.
