output "server_id" {
  description = "ID of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.id
}

output "server_name" {
  description = "Name of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.name
}

output "server_fqdn" {
  description = "Fully qualified domain name of the PostgreSQL server"
  value       = azurerm_postgresql_flexible_server.main.fqdn
}

output "database_name" {
  description = "Name of the GridLens database"
  value       = azurerm_postgresql_flexible_server_database.gridlens.name
}

output "connection_string_secret_id" {
  description = "Key Vault secret ID for the database connection string"
  value       = azurerm_key_vault_secret.db_connection_string.id
}

output "connection_string_secret_uri" {
  description = "Key Vault secret URI for the database connection string"
  value       = azurerm_key_vault_secret.db_connection_string.versionless_id
}
