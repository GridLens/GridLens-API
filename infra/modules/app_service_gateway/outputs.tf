output "app_service_id" {
  description = "ID of the API Gateway App Service"
  value       = azurerm_linux_web_app.gateway.id
}

output "app_service_name" {
  description = "Name of the API Gateway App Service"
  value       = azurerm_linux_web_app.gateway.name
}

output "default_hostname" {
  description = "Default hostname of the API Gateway"
  value       = azurerm_linux_web_app.gateway.default_hostname
}

output "principal_id" {
  description = "Principal ID of the managed identity"
  value       = azurerm_linux_web_app.gateway.identity[0].principal_id
}

output "app_service_plan_id" {
  description = "ID of the App Service Plan"
  value       = local.app_service_plan_id
}

output "outbound_ip_addresses" {
  description = "Outbound IP addresses of the App Service"
  value       = azurerm_linux_web_app.gateway.outbound_ip_addresses
}
