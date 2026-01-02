resource "azurerm_linux_web_app" "core" {
  name                = "app-gl-${var.environment}-core"
  resource_group_name = var.resource_group_name
  location            = var.location
  service_plan_id     = var.app_service_plan_id

  https_only                    = true
  public_network_access_enabled = false

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on              = true
    ftps_state             = "Disabled"
    http2_enabled          = true
    minimum_tls_version    = "1.2"
    vnet_route_all_enabled = true

    application_stack {
      node_version = "20-lts"
    }

    ip_restriction {
      name       = "AllowGatewaySubnet"
      action     = "Allow"
      priority   = 100
      virtual_network_subnet_id = var.gateway_subnet_id
    }

    ip_restriction {
      name       = "DenyAll"
      action     = "Deny"
      priority   = 2147483647
      ip_address = "0.0.0.0/0"
    }
  }

  app_settings = {
    WEBSITE_NODE_DEFAULT_VERSION = "~20"
    SCM_DO_BUILD_DURING_DEPLOYMENT = "true"
    WEBSITES_PORT                  = "8080"

    PORT        = "8080"
    ENVIRONMENT = upper(var.environment)
    SIM_MODE    = var.environment == "demo" ? "true" : "false"
    AUTH_MODE   = "entra"

    ENTRA_TENANT_ID    = "@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}secrets/ENTRA-TENANT-ID/)"
    ENTRA_CLIENT_ID    = "@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}secrets/ENTRA-CLIENT-ID/)"
    ENTRA_CLIENT_SECRET = "@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}secrets/ENTRA-CLIENT-SECRET/)"

    DATABASE_URL       = "@Microsoft.KeyVault(SecretUri=${var.key_vault_uri}secrets/DATABASE-URL/)"
    GRIDLENS_DATA_DIR  = "/home/site/wwwroot/data"

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

resource "azurerm_role_assignment" "core_keyvault" {
  scope                = var.key_vault_id
  role_definition_name = "Key Vault Secrets User"
  principal_id         = azurerm_linux_web_app.core.identity[0].principal_id
}

resource "azurerm_private_endpoint" "core" {
  name                = "pe-gl-${var.environment}-core"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.subnet_id

  private_service_connection {
    name                           = "psc-gl-${var.environment}-core"
    private_connection_resource_id = azurerm_linux_web_app.core.id
    is_manual_connection           = false
    subresource_names              = ["sites"]
  }

  private_dns_zone_group {
    name                 = "core-dns-group"
    private_dns_zone_ids = [var.private_dns_zone_id]
  }

  tags = var.tags
}
