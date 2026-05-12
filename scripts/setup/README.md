# FundrBolt Beta Deployment — Setup Scripts

This directory contains numbered shell scripts that automate the full Azure production deployment setup.

## Prerequisites

- Ubuntu/Debian Linux (WSL2 is fine)
- `sudo` access (for Azure CLI installation)
- GitHub CLI (`gh`) installed and authenticated as `jeanesdev`
- Active Azure subscription

## Quick Start

```bash
# Run all steps interactively (with pause between each):
./scripts/setup/run-setup.sh

# Or resume from a specific step:
./scripts/setup/run-setup.sh --start 04
```

## Steps

| Script | What it does | Duration |
|--------|-------------|----------|
| `00-install-prerequisites.sh` | Installs Azure CLI, Bicep, jq | ~2 min |
| `01-azure-login.sh` | `az login` + select subscription | ~2 min (browser) |
| `02-register-providers.sh` | Register Azure resource providers | ~5 min |
| `03-create-service-principal.sh` | Create OIDC app registration for GitHub Actions | ~2 min |
| `04-deploy-infrastructure.sh` | Deploy all Azure resources via Bicep | ~15–20 min |
| `05-populate-keyvault.sh` | Write all secrets to Key Vault | ~3 min |
| `06-set-github-secrets.sh` | Set GitHub Actions secrets via `gh` CLI | ~2 min |
| `07-trigger-deployment.sh` | Merge PR #108 → main to trigger CI/CD | ~1 min |
| `08-run-migrations.sh` | Run DB migrations via Container App Job | ~5 min |

## State File

Scripts save state to `.azure-setup-state` in the repo root. This file contains sensitive values (passwords, connection strings). **Never commit it** — it is listed in `.gitignore`.

```bash
# View current state (after some steps have run):
cat .azure-setup-state
```

## Remaining Manual Steps (cannot be automated)

### 1. Sentry Error Tracking

1. Create account at https://sentry.io/signup
2. Create organization: `fundrbolt`
3. Create 4 projects:
   - `fundrbolt-backend` (Platform: Python/FastAPI)
   - `fundrbolt-admin-pwa` (Platform: React)
   - `fundrbolt-donor-pwa` (Platform: React)
   - `fundrbolt-landing` (Platform: React)
4. Get DSNs and auth token, then update secrets:

```bash
# Backend DSN (goes to Key Vault):
az keyvault secret set \
  --vault-name fundrbolt-production-kv \
  --name SENTRY-DSN \
  --value "https://YOUR_BACKEND_DSN@sentry.io/..."

# Frontend DSNs (go to GitHub Secrets):
gh secret set VITE_SENTRY_DSN_ADMIN   --repo jeanesdev/fundrbolt-platform
gh secret set VITE_SENTRY_DSN_DONOR   --repo jeanesdev/fundrbolt-platform
gh secret set VITE_SENTRY_DSN_LANDING --repo jeanesdev/fundrbolt-platform
gh secret set SENTRY_AUTH_TOKEN        --repo jeanesdev/fundrbolt-platform
gh secret set SENTRY_ORG               --repo jeanesdev/fundrbolt-platform
```

5. Re-run the frontend deploy workflows:
```bash
gh workflow run frontend-deploy.yml    --repo jeanesdev/fundrbolt-platform
gh workflow run donor-pwa-deploy.yml   --repo jeanesdev/fundrbolt-platform
gh workflow run landing-site-deploy.yml --repo jeanesdev/fundrbolt-platform
```

### 2. DNS Records

Add these CNAMEs at your domain registrar (fundrbolt.com):

| Hostname | Type | Target |
|----------|------|--------|
| `api` | CNAME | `fundrbolt-production-api.<cae-domain>.azurecontainerapps.io` |
| `app` | CNAME | `<admin-swa-hostname>` (from `.azure-setup-state`) |
| `give` | CNAME | `<donor-swa-hostname>` (from `.azure-setup-state`) |
| `www` | CNAME | `<landing-swa-hostname>` (from `.azure-setup-state`) |
| `@` | A/ALIAS | `<landing-swa-hostname>` (if registrar supports ALIAS) |

DNS values are printed at the end of `04-deploy-infrastructure.sh`.

## Testing Checklist

After everything is deployed:

```bash
# 1. Backend health
curl https://api.fundrbolt.com/health

# 2. Admin panel
open https://app.fundrbolt.com

# 3. Donor portal
open https://give.fundrbolt.com

# 4. Landing page
open https://fundrbolt.com

# 5. Full login flow
# Log in with: admin@fundrbolt.com / <password from .azure-setup-state>
```

See [docs/046-beta-deployment-manual-setup.md](../../docs/046-beta-deployment-manual-setup.md) for the full post-deployment testing checklist.

## Troubleshooting

### Azure CLI login issues
```bash
az login --use-device-code  # Use device code if browser doesn't open
```

### Bicep deployment fails
```bash
# Check deployment errors
az deployment sub show \
  --name "fundrbolt-production-beta-*" \
  --query properties.error
```

### Container App not starting
```bash
az containerapp logs show \
  --resource-group fundrbolt-production-rg \
  --name fundrbolt-production-api \
  --follow
```

### Key Vault access denied
The Container Apps use system-assigned managed identities. If they can't read KV secrets, check:
```bash
az role assignment list \
  --scope /subscriptions/<sub-id>/resourceGroups/fundrbolt-production-rg/providers/Microsoft.KeyVault/vaults/fundrbolt-production-kv \
  --output table
```
