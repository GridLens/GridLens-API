resource "random_password" "admin" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "azurerm_postgresql_flexible_server" "main" {
  name                = "pgflex-gl-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name

  version                      = "15"
  delegated_subnet_id          = var.subnet_id
  private_dns_zone_id          = var.private_dns_zone_id
  public_network_access_enabled = false

  administrator_login    = var.admin_username
  administrator_password = random_password.admin.result

  storage_mb = var.storage_mb
  sku_name   = var.sku_name

  backup_retention_days        = var.environment == "prod" ? 35 : 7
  geo_redundant_backup_enabled = var.environment == "prod" ? true : false

  high_availability {
    mode = var.environment == "prod" ? "ZoneRedundant" : "Disabled"
  }

  tags = var.tags

  lifecycle {
    ignore_changes = [
      zone,
      high_availability[0].standby_availability_zone
    ]
  }
}

resource "azurerm_postgresql_flexible_server_database" "gridlens" {
  name      = "gridlens_${var.environment}"
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

resource "azurerm_key_vault_secret" "db_password" {
  name         = "DATABASE-ADMIN-PASSWORD"
  value        = random_password.admin.result
  key_vault_id = var.key_vault_id

  tags = var.tags
}

resource "azurerm_key_vault_secret" "db_connection_string" {
  name         = "DATABASE-URL"
  value        = "postgresql://${var.admin_username}:${random_password.admin.result}@${azurerm_postgresql_flexible_server.main.fqdn}:5432/${azurerm_postgresql_flexible_server_database.gridlens.name}?sslmode=require"
  key_vault_id = var.key_vault_id

  tags = var.tags
}
