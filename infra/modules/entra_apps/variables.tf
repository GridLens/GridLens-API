variable "environment" {
  description = "Environment name (demo, pilot, prod)"
  type        = string

  validation {
    condition     = contains(["demo", "pilot", "prod"], var.environment)
    error_message = "Environment must be one of: demo, pilot, prod"
  }
}

variable "key_vault_id" {
  description = "ID of the Key Vault to store secrets"
  type        = string
}

variable "api_redirect_uris" {
  description = "Redirect URIs for the API application"
  type        = list(string)
  default     = []
}

variable "web_redirect_uris" {
  description = "Redirect URIs for the Web Console application"
  type        = list(string)
}
