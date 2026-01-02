output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

output "web_console_url" {
  description = "URL of the Web Console"
  value       = "https://${local.web_domain}"
}

output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = "https://${local.api_domain}"
}

output "static_web_app_id" {
  description = "ID of the Static Web App"
  value       = module.static_web_app.static_web_app_id
}

output "api_gateway_app_service_id" {
  description = "ID of the API Gateway App Service"
  value       = module.api_gateway.app_service_id
}

output "core_api_app_service_id" {
  description = "ID of the Core API App Service"
  value       = module.core_api.app_service_id
}

output "key_vault_id" {
  description = "ID of the Key Vault"
  value       = module.key_vault.key_vault_id
}

output "key_vault_uri" {
  description = "URI of the Key Vault"
  value       = module.key_vault.key_vault_uri
}

output "postgres_server_name" {
  description = "Name of the PostgreSQL server"
  value       = module.postgres.server_name
}

output "entra_api_app_id" {
  description = "Application ID of the API app registration"
  value       = module.entra_apps.api_app_id
}

output "entra_web_app_id" {
  description = "Application ID of the Web Console app registration"
  value       = module.entra_apps.web_app_id
}

output "static_web_app_deployment_token" {
  description = "Deployment token for Static Web App"
  value       = module.static_web_app.api_key
  sensitive   = true
}

output "static_web_app_default_hostname" {
  description = "Default hostname of the Static Web App"
  value       = module.static_web_app.default_hostname
}
