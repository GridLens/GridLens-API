locals {
  environment = "demo"
  location    = var.location

  tags = {
    Environment = "DEMO"
    Project     = "GridLens"
    ManagedBy   = "Terraform"
  }

  web_domain = "demo.app.${var.base_domain}"
  api_domain = "demo.api.${var.base_domain}"
}

resource "azurerm_resource_group" "main" {
  name     = "rg-gridlens-${local.environment}"
  location = local.location

  tags = local.tags
}

module "networking" {
  source = "../../modules/networking"

  environment         = local.environment
  location            = local.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags
}

module "key_vault" {
  source = "../../modules/key_vault"

  environment         = local.environment
  location            = local.location
  resource_group_name = azurerm_resource_group.main.name
  allowed_ip_ranges   = var.allowed_ip_ranges
  tags                = local.tags
}

module "entra_apps" {
  source = "../../modules/entra_apps"

  environment  = local.environment
  key_vault_id = module.key_vault.key_vault_id

  web_redirect_uris = [
    "https://${local.web_domain}/auth/callback",
    "http://localhost:3000/auth/callback"
  ]

  depends_on = [module.key_vault]
}

module "postgres" {
  source = "../../modules/postgres_flexible"

  environment          = local.environment
  location             = local.location
  resource_group_name  = azurerm_resource_group.main.name
  subnet_id            = module.networking.db_subnet_id
  private_dns_zone_id  = module.networking.postgres_private_dns_zone_id
  key_vault_id         = module.key_vault.key_vault_id
  sku_name             = "B_Standard_B1ms"
  storage_mb           = 32768
  tags                 = local.tags

  depends_on = [module.networking, module.key_vault]
}

resource "azurerm_application_insights" "main" {
  name                = "appi-gl-${local.environment}"
  location            = local.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "Node.JS"

  tags = local.tags
}

module "api_gateway" {
  source = "../../modules/app_service_gateway"

  environment                    = local.environment
  location                       = local.location
  resource_group_name            = azurerm_resource_group.main.name
  subnet_id                      = module.networking.appsvc_subnet_id
  key_vault_id                   = module.key_vault.key_vault_id
  key_vault_uri                  = module.key_vault.key_vault_uri
  entra_audience                 = module.entra_apps.api_identifier_uri
  core_api_internal_url          = "https://app-gl-${local.environment}-core.azurewebsites.net"
  cors_allowed_origins           = ["https://${local.web_domain}", "http://localhost:3000"]
  app_insights_connection_string = azurerm_application_insights.main.connection_string
  custom_domain                  = local.api_domain
  app_service_plan_sku           = "B1"
  tags                           = local.tags

  depends_on = [module.networking, module.key_vault, module.entra_apps]
}

module "core_api" {
  source = "../../modules/app_service_core"

  environment                    = local.environment
  location                       = local.location
  resource_group_name            = azurerm_resource_group.main.name
  app_service_plan_id            = module.api_gateway.app_service_plan_id
  subnet_id                      = module.networking.appsvc_subnet_id
  gateway_subnet_id              = module.networking.appsvc_subnet_id
  private_dns_zone_id            = module.networking.webapp_private_dns_zone_id
  key_vault_id                   = module.key_vault.key_vault_id
  key_vault_uri                  = module.key_vault.key_vault_uri
  app_insights_connection_string = azurerm_application_insights.main.connection_string
  tags                           = local.tags

  depends_on = [module.networking, module.key_vault, module.entra_apps]
}

module "static_web_app" {
  source = "../../modules/static_web_app"

  environment                = local.environment
  location                   = local.location
  resource_group_name        = azurerm_resource_group.main.name
  sku_tier                   = "Free"
  custom_domain              = local.web_domain
  api_base_url               = "https://${local.api_domain}"
  entra_client_id            = module.entra_apps.web_app_id
  entra_authority            = "https://login.microsoftonline.com/${module.entra_apps.tenant_id}"
  entra_redirect_uri         = "https://${local.web_domain}/auth/callback"
  entra_post_logout_redirect = "https://${local.web_domain}/logout"
  entra_scopes               = module.entra_apps.access_as_user_scope
  tags                       = local.tags

  depends_on = [module.entra_apps]
}
