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

variable "create_app_service_plan" {
  description = "Whether to create a new App Service Plan"
  type        = bool
  default     = true
}

variable "existing_app_service_plan_id" {
  description = "ID of existing App Service Plan (if not creating new)"
  type        = string
  default     = ""
}

variable "app_service_plan_sku" {
  description = "SKU for the App Service Plan"
  type        = string
  default     = "P1v3"
}

variable "subnet_id" {
  description = "ID of the subnet for VNet integration"
  type        = string
}

variable "key_vault_id" {
  description = "ID of the Key Vault"
  type        = string
}

variable "key_vault_uri" {
  description = "URI of the Key Vault"
  type        = string
}

variable "entra_audience" {
  description = "Entra ID audience for JWT validation"
  type        = string
}

variable "core_api_internal_url" {
  description = "Internal URL of the Core API"
  type        = string
}

variable "cors_allowed_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
}

variable "app_insights_connection_string" {
  description = "Application Insights connection string"
  type        = string
  default     = ""
}

variable "custom_domain" {
  description = "Custom domain for the API Gateway"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
