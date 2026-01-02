# GridLens Energy Infrastructure

This directory contains Terraform infrastructure-as-code for deploying GridLens Energy to Microsoft Azure.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Azure Static Web Apps                         │
│                   (app.gridlensenergy.com)                       │
│                       Web Console (Next.js)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Azure App Service                             │
│                   (api.gridlensenergy.com)                       │
│                       API Gateway (Node.js)                      │
│                   ┌─────────────────────────┐                    │
│                   │   Entra JWT Validation  │                    │
│                   │   RBAC Enforcement      │                    │
│                   └─────────────────────────┘                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Private Endpoint
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Azure App Service (Private)                   │
│                       Core API (Node.js)                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Private Endpoint
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Azure PostgreSQL Flexible Server                    │
│                   (Private, VNet integrated)                     │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
infra/
├── modules/                    # Reusable Terraform modules
│   ├── networking/             # VNet, subnets, private DNS zones
│   ├── key_vault/              # Azure Key Vault for secrets
│   ├── postgres_flexible/      # PostgreSQL Flexible Server
│   ├── static_web_app/         # Azure Static Web Apps
│   ├── app_service_gateway/    # API Gateway App Service
│   ├── app_service_core/       # Core API App Service (private)
│   └── entra_apps/             # Entra ID app registrations
├── envs/                       # Environment-specific configurations
│   ├── demo/                   # DEMO environment
│   ├── pilot/                  # PILOT environment
│   └── prod/                   # PRODUCTION environment
├── shared/                     # Shared Terraform configuration
│   ├── providers.tf            # Provider requirements
│   ├── backend.tf              # Backend configuration
│   └── variables.tf            # Common variables
└── README.md                   # This file
```

## Prerequisites

### Azure Requirements

1. **Azure Subscription** with Owner or Contributor access
2. **Azure AD** with permissions to create app registrations
3. **Storage Account** for Terraform state:
   ```bash
   az group create --name rg-gridlens-tfstate --location eastus2
   az storage account create \
     --name stglgridlenstf \
     --resource-group rg-gridlens-tfstate \
     --sku Standard_LRS
   az storage container create \
     --name tfstate \
     --account-name stglgridlenstf
   ```

### GitHub OIDC Federation

Configure Azure AD for GitHub Actions OIDC authentication:

```bash
# Create app registration for GitHub Actions
az ad app create --display-name "GitHub Actions - GridLens"

# Get the app ID
APP_ID=$(az ad app list --display-name "GitHub Actions - GridLens" --query "[0].appId" -o tsv)

# Create service principal
az ad sp create --id $APP_ID

# Assign Contributor role
az role assignment create \
  --assignee $APP_ID \
  --role Contributor \
  --scope /subscriptions/{subscription-id}

# Create federated credential for main branch
az ad app federated-credential create \
  --id $APP_ID \
  --parameters '{
    "name": "github-main",
    "issuer": "https://token.actions.githubusercontent.com",
    "subject": "repo:{owner}/{repo}:ref:refs/heads/main",
    "audiences": ["api://AzureADTokenExchange"]
  }'

# Create federated credentials for each environment
for ENV in demo pilot production; do
  az ad app federated-credential create \
    --id $APP_ID \
    --parameters "{
      \"name\": \"github-env-$ENV\",
      \"issuer\": \"https://token.actions.githubusercontent.com\",
      \"subject\": \"repo:{owner}/{repo}:environment:$ENV\",
      \"audiences\": [\"api://AzureADTokenExchange\"]
    }"
done
```

### GitHub Secrets

Configure these secrets in your GitHub repository:

| Secret | Value |
|--------|-------|
| `AZURE_CLIENT_ID` | App registration client ID |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |

## Deployment

### Step 1: Deploy DEMO Environment First

Always start with DEMO to validate the infrastructure:

```bash
# Navigate to DEMO environment
cd infra/envs/demo

# Copy shared configuration
cp ../../shared/providers.tf .
cp ../../shared/backend.tf .

# Initialize Terraform
terraform init -backend-config="backend.tfvars"

# Plan deployment
terraform plan -out=tfplan

# Review the plan, then apply
terraform apply tfplan
```

Or use GitHub Actions:

1. Go to **Actions** → **Deploy DEMO Environment**
2. Click **Run workflow**
3. Select action: `plan` (to review) or `apply` (to deploy)

### Step 2: Deploy PILOT Environment

After DEMO is validated:

```bash
cd infra/envs/pilot
cp ../../shared/providers.tf .
cp ../../shared/backend.tf .
terraform init -backend-config="backend.tfvars"
terraform plan -out=tfplan
terraform apply tfplan
```

### Step 3: Deploy PRODUCTION Environment

After PILOT is validated:

```bash
cd infra/envs/prod
cp ../../shared/providers.tf .
cp ../../shared/backend.tf .
terraform init -backend-config="backend.tfvars"
terraform plan -out=tfplan
terraform apply tfplan
```

For production via GitHub Actions:
1. Type `PRODUCTION` in the confirmation field
2. Select action: `apply`

## Module Summary

### networking
Creates VNet with subnets for App Services and PostgreSQL, plus private DNS zones.

**Outputs:**
- `vnet_id` - Virtual network ID
- `appsvc_subnet_id` - App Service subnet ID
- `db_subnet_id` - Database subnet ID
- `postgres_private_dns_zone_id` - PostgreSQL DNS zone ID

### key_vault
Creates Azure Key Vault with RBAC authorization for secrets management.

**Outputs:**
- `key_vault_id` - Key Vault ID
- `key_vault_uri` - Key Vault URI for references

### postgres_flexible
Creates PostgreSQL Flexible Server with private access and stores credentials in Key Vault.

**Outputs:**
- `server_fqdn` - Server fully qualified domain name
- `connection_string_secret_uri` - Key Vault reference for connection string

### static_web_app
Creates Azure Static Web App for the Next.js Web Console.

**Outputs:**
- `static_web_app_id` - Static Web App ID
- `default_hostname` - Default Azure hostname
- `api_key` - Deployment token (sensitive)

### app_service_gateway
Creates the publicly accessible API Gateway App Service with VNet integration.

**Outputs:**
- `app_service_id` - App Service ID
- `default_hostname` - Default Azure hostname
- `principal_id` - Managed identity principal ID

### app_service_core
Creates the private Core API App Service with private endpoint.

**Outputs:**
- `app_service_id` - App Service ID
- `internal_url` - Private endpoint URL

### entra_apps
Creates Entra ID app registrations for API and Web Console with roles and scopes.

**Outputs:**
- `api_app_id` - API app client ID
- `web_app_id` - Web Console app client ID
- `access_as_user_scope` - Full scope URI

## Environment Comparison

| Feature | DEMO | PILOT | PROD |
|---------|------|-------|------|
| App Service SKU | B1 | P1v3 | P1v3 |
| PostgreSQL SKU | B_Standard_B1ms | GP_Standard_D2s_v3 | GP_Standard_D2s_v3 |
| PostgreSQL Storage | 32 GB | 128 GB | 256 GB |
| Geo-redundant backup | No | No | Yes |
| High availability | No | No | Zone Redundant |
| Static Web App | Free | Standard | Standard |
| Log retention | 7 days | 30 days | 90 days |
| SIM_MODE | true | false | false |

## DNS Configuration

After deployment, configure these DNS records:

### Production
```
app.gridlensenergy.com    CNAME → stapp-gl-prod-web.azurestaticapps.net
api.gridlensenergy.com    CNAME → app-gl-prod-gateway.azurewebsites.net
```

### DEMO
```
demo.app.gridlensenergy.com    CNAME → stapp-gl-demo-web.azurestaticapps.net
demo.api.gridlensenergy.com    CNAME → app-gl-demo-gateway.azurewebsites.net
```

### PILOT
```
pilot.app.gridlensenergy.com    CNAME → stapp-gl-pilot-web.azurestaticapps.net
pilot.api.gridlensenergy.com    CNAME → app-gl-pilot-gateway.azurewebsites.net
```

## Post-Deployment Steps

1. **Configure DNS** - Add CNAME records as shown above
2. **Grant Admin Consent** - In Azure AD, grant admin consent for API permissions
3. **Assign Users to Roles** - Assign GridLens.Admin/Operator/ReadOnly roles to users
4. **Verify Deployment** - Run verification checklist in `docs/deployment_verification.md`
5. **Deploy Applications** - GitHub Actions will deploy code after infrastructure

## Terraform State

State files are stored in Azure Storage:

| Environment | State Key |
|-------------|-----------|
| DEMO | `demo.terraform.tfstate` |
| PILOT | `pilot.terraform.tfstate` |
| PROD | `prod.terraform.tfstate` |

## Estimated Costs (Monthly)

| Environment | Estimated Cost |
|-------------|----------------|
| DEMO | ~$50 |
| PILOT | ~$300 |
| PROD | ~$350 |

## Next Steps

1. **DEMO First**: Deploy DEMO environment using `terraform plan` followed by `terraform apply`
2. **Validate**: Run verification checklist against DEMO
3. **PILOT**: After validation, deploy PILOT for customer trials
4. **PROD**: After PILOT success, deploy PRODUCTION

## Support

For infrastructure issues, check:
- Azure Portal → Resource Group → Activity Log
- Application Insights → Failures
- App Service → Log Stream

---

*Infrastructure as Code for GridLens Energy*
*Version 1.0 - January 2026*
