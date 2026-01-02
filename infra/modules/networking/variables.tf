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

variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = string
  default     = "10.0.0.0/16"
}

variable "appsvc_subnet_prefix" {
  description = "Address prefix for the App Service subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "db_subnet_prefix" {
  description = "Address prefix for the database subnet"
  type        = string
  default     = "10.0.2.0/24"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}
