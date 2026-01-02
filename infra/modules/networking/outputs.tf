output "vnet_id" {
  description = "ID of the virtual network"
  value       = azurerm_virtual_network.main.id
}

output "vnet_name" {
  description = "Name of the virtual network"
  value       = azurerm_virtual_network.main.name
}

output "appsvc_subnet_id" {
  description = "ID of the App Service subnet"
  value       = azurerm_subnet.appsvc.id
}

output "db_subnet_id" {
  description = "ID of the database subnet"
  value       = azurerm_subnet.db.id
}

output "postgres_private_dns_zone_id" {
  description = "ID of the PostgreSQL private DNS zone"
  value       = azurerm_private_dns_zone.postgres.id
}

output "webapp_private_dns_zone_id" {
  description = "ID of the Web App private DNS zone"
  value       = azurerm_private_dns_zone.webapp.id
}
