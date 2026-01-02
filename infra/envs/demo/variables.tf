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

variable "allowed_ip_ranges" {
  description = "List of IP ranges allowed to access resources"
  type        = list(string)
  default     = []
}
