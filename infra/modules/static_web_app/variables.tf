variable "environment" {
  description = "Environment name (demo, pilot, prod)"
  type        = string

  validation {
    condition     = contains(["demo", "pilot", "prod"], var.environment)
    error_message = "Environment must be one of: demo, pilot, prod"
  }
}

variable "location" {
  description = "Azure region for resources"
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "sku_tier" {
  description = "SKU tier for Static Web App"
  type        = string
  default     = "Standard"
}

variable "custom_domain" {
  description = "Custom domain for the Static Web App"
  type        = string
  default     = ""
}

variable "api_base_url" {
  description = "Base URL for the API"
  type        = string
}

variable "entra_client_id" {
  description = "Entra ID client ID for the web app"
  type        = string
}

variable "entra_authority" {
  description = "Entra ID authority URL"
  type        = string
}

variable "entra_redirect_uri" {
  description = "Entra ID redirect URI"
  type        = string
}

variable "entra_post_logout_redirect" {
  description = "Entra ID post-logout redirect URI"
  type        = string
}

variable "entra_scopes" {
  description = "Entra ID scopes"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
