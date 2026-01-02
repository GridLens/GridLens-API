output "app_service_id" {
  description = "ID of the Core API App Service"
  value       = azurerm_linux_web_app.core.id
}

output "app_service_name" {
  description = "Name of the Core API App Service"
  value       = azurerm_linux_web_app.core.name
}

output "default_hostname" {
  description = "Default hostname of the Core API"
  value       = azurerm_linux_web_app.core.default_hostname
}

output "principal_id" {
  description = "Principal ID of the managed identity"
  value       = azurerm_linux_web_app.core.identity[0].principal_id
}

output "private_endpoint_ip" {
  description = "Private IP address of the Core API"
  value       = azurerm_private_endpoint.core.private_service_connection[0].private_ip_address
}

output "internal_url" {
  description = "Internal URL for the Core API via private endpoint"
  value       = "https://${azurerm_linux_web_app.core.name}.privatelink.azurewebsites.net"
}
