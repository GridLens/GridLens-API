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
  default     = "eastus2"
}

variable "base_domain" {
  description = "Base domain for GridLens"
  type        = string
  default     = "gridlensenergy.com"
}

variable "app_service_plan_sku" {
  description = "SKU for the App Service Plan"
  type        = string
  default     = "P1v3"
}

variable "postgres_sku" {
  description = "SKU for PostgreSQL Flexible Server"
  type        = string
  default     = "GP_Standard_D2s_v3"
}

variable "postgres_storage_mb" {
  description = "Storage size for PostgreSQL in MB"
  type        = number
  default     = 131072
}

variable "allowed_ip_ranges" {
  description = "List of IP ranges allowed to access resources"
  type        = list(string)
  default     = []
}
