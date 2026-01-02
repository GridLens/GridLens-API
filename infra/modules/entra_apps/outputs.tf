output "api_app_id" {
  description = "Application ID of the API app registration"
  value       = azuread_application.api.client_id
}

output "api_object_id" {
  description = "Object ID of the API app registration"
  value       = azuread_application.api.object_id
}

output "web_app_id" {
  description = "Application ID of the Web Console app registration"
  value       = azuread_application.web.client_id
}

output "web_object_id" {
  description = "Object ID of the Web Console app registration"
  value       = azuread_application.web.object_id
}

output "api_service_principal_id" {
  description = "Service Principal ID of the API app"
  value       = azuread_service_principal.api.id
}

output "tenant_id" {
  description = "Entra ID Tenant ID"
  value       = data.azuread_client_config.current.tenant_id
}

output "api_identifier_uri" {
  description = "Identifier URI for the API"
  value       = azuread_application.api.identifier_uris[0]
}

output "access_as_user_scope" {
  description = "Full scope URI for access_as_user"
  value       = "${azuread_application.api.identifier_uris[0]}/access_as_user"
}
