resource "azurerm_service_plan" "main" {
  count = var.create_app_service_plan ? 1 : 0

  name                = "asp-gl-${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "Linux"
  sku_name            = var.app_service_plan_sku

  tags = var.tags
}

locals {
  app_service_plan_id = var.create_app_service_plan ? azurerm_service_plan.main[0].id : var.existing_app_service_plan_id
}

resource "azurerm_linux_web_app" "gateway" {
  name                = "app-gl-${var.environment}-gateway"
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = local.app_service_plan_id

  https_only = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on                = var.app_service_plan_sku != "F1" && var.app_service_plan_sku != "D1"
    ftps_state               = "Disabled"
    http2_enabled            = true
    minimum_tls_version      = "1.2"
    vnet_route_all_enabled   = true

    application_stack {
      node_version = "20-lts"
    }

    cors {
      allowed_origins     = var.cors_allowed_origins
      support_credentials = true
    }
  }

  app_settings = {
    WEBSITE_NODE_DEFAULT_VERSION = "~20"
    SCM_DO_BUILD_DURING_DEPLOYMENT = "true"
    WEBSITES_PORT                  = "8090"

    PORT            = "8090"
    GATEWAY_PORT    = "8090"
    ENVIRONMENT     = upper(var.environment)
    AUTH_MODE       = "entra"
    ALLOW_TENANT_HEADER = "false"
    INTERNAL_ROUTES_ENABLED = "true"

    ENTRA_TENANT_ID    = "@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}secrets/ENTRA-TENANT-ID/)"
    ENTRA_CLIENT_ID    = "@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}secrets/ENTRA-CLIENT-ID/)"
    ENTRA_CLIENT_SECRET = "@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}secrets/ENTRA-CLIENT-SECRET/)"
    ENTRA_AUDIENCE     = var.entra_audience
    
    DATABASE_URL       = "@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}secrets/DATABASE-URL/)"
    
    CORE_API_URL       = var.core_api_internal_url
    CONFIDENCE_URL     = "${var.core_api_internal_url}:8102"
    METERIQ_URL        = "${var.core_api_internal_url}:8103"

    APPLICATIONINSIGHTS_CONNECTION_STRING = var.app_insights_connection_string
  }

  virtual_network_subnet_id = var.subnet_id

  tags = var.tags

  lifecycle {
    ignore_changes = [
      app_settings["WEBSITE_RUN_FROM_PACKAGE"]
    ]
  }
}

resource "azurerm_role_assignment" "gateway_keyvault" {
  scope                = var.key_vault_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.gateway.identity[0].principal_id
}

resource "azurerm_app_service_custom_hostname_binding" "gateway" {
  count = var.custom_domain != "" ? 1 : 0

  hostname            = var.custom_domain
  app_service_name    = azurerm_linux_web_app.gateway.name
  resource_group_name = var.resource_group_name
}

resource "azurerm_app_service_managed_certificate" "gateway" {
  count = var.custom_domain != "" ? 1 : 0

  custom_hostname_binding_id = azurerm_app_service_custom_hostname_binding.gateway[0].id
}

resource "azurerm_app_service_certificate_binding" "gateway" {
  count = var.custom_domain != "" ? 1 : 0

  hostname_binding_id = azurerm_app_service_custom_hostname_binding.gateway[0].id
  certificate_id      = azurerm_app_service_managed_certificate.gateway[0].id
  ssl_state           = "SniEnabled"
}
