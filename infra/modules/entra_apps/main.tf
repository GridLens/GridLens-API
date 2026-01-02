data "azuread_client_config" "current" {}

resource "random_uuid" "access_as_user_scope_id" {}

resource "azuread_application" "api" {
  display_name     = "GridLens API - ${upper(var.environment)}"
  identifier_uris  = ["api://gl-${var.environment}-gateway"]
  sign_in_audience = "AzureADMyOrg"

  api {
    requested_access_token_version = 2

    oauth2_permission_scope {
      admin_consent_description  = "Allows the app to access GridLens API on behalf of the signed-in user"
      admin_consent_display_name = "Access GridLens API as user"
      enabled                    = true
      id                         = random_uuid.access_as_user_scope_id.result
      type                       = "User"
      user_consent_description   = "Allow the application to access GridLens on your behalf"
      user_consent_display_name  = "Access GridLens"
      value                      = "access_as_user"
    }
  }

  app_role {
    allowed_member_types = ["User"]
    description          = "Full administrative access to GridLens"
    display_name         = "GridLens Admin"
    enabled              = true
    id                   = "00000000-0000-0000-0000-000000000001"
    value                = "GridLens.Admin"
  }

  app_role {
    allowed_member_types = ["User"]
    description          = "Operational access to GridLens"
    display_name         = "GridLens Operator"
    enabled              = true
    id                   = "00000000-0000-0000-0000-000000000002"
    value                = "GridLens.Operator"
  }

  app_role {
    allowed_member_types = ["User"]
    description          = "Read-only access to GridLens"
    display_name         = "GridLens ReadOnly"
    enabled              = true
    id                   = "00000000-0000-0000-0000-000000000003"
    value                = "GridLens.ReadOnly"
  }

  required_resource_access {
    resource_app_id = "00000003-0000-0000-c000-000000000000"

    resource_access {
      id   = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"
      type = "Scope"
    }

    resource_access {
      id   = "37f7f235-527c-4136-accd-4a02d197296e"
      type = "Scope"
    }

    resource_access {
      id   = "14dad69e-099b-42c9-810b-d002981feec1"
      type = "Scope"
    }
  }

  web {
    redirect_uris = var.api_redirect_uris

    implicit_grant {
      access_token_issuance_enabled = false
      id_token_issuance_enabled     = false
    }
  }

  tags = ["GridLens", var.environment]
}

resource "azuread_service_principal" "api" {
  client_id                    = azuread_application.api.client_id
  app_role_assignment_required = false
  owners                       = [data.azuread_client_config.current.object_id]
}

resource "azuread_application_password" "api" {
  application_id = azuread_application.api.id
  display_name   = "GridLens API Secret - ${upper(var.environment)}"
  end_date       = timeadd(timestamp(), "8760h")

  lifecycle {
    ignore_changes = [end_date]
  }
}

resource "azuread_application" "web" {
  display_name     = "GridLens Web Console - ${upper(var.environment)}"
  sign_in_audience = "AzureADMyOrg"

  required_resource_access {
    resource_app_id = "00000003-0000-0000-c000-000000000000"

    resource_access {
      id   = "e1fe6dd8-ba31-4d61-89e7-88639da4683d"
      type = "Scope"
    }

    resource_access {
      id   = "37f7f235-527c-4136-accd-4a02d197296e"
      type = "Scope"
    }

    resource_access {
      id   = "14dad69e-099b-42c9-810b-d002981feec1"
      type = "Scope"
    }
  }

  required_resource_access {
    resource_app_id = azuread_application.api.client_id

    resource_access {
      id   = random_uuid.access_as_user_scope_id.result
      type = "Scope"
    }
  }

  single_page_application {
    redirect_uris = var.web_redirect_uris
  }

  tags = ["GridLens", var.environment]
}

resource "azuread_service_principal" "web" {
  client_id                    = azuread_application.web.client_id
  app_role_assignment_required = false
  owners                       = [data.azuread_client_config.current.object_id]
}

resource "azurerm_key_vault_secret" "entra_tenant_id" {
  name         = "ENTRA-TENANT-ID"
  value        = data.azuread_client_config.current.tenant_id
  key_vault_id = var.key_vault_id
}

resource "azurerm_key_vault_secret" "entra_client_id" {
  name         = "ENTRA-CLIENT-ID"
  value        = azuread_application.api.client_id
  key_vault_id = var.key_vault_id
}

resource "azurerm_key_vault_secret" "entra_client_secret" {
  name         = "ENTRA-CLIENT-SECRET"
  value        = azuread_application_password.api.value
  key_vault_id = var.key_vault_id
}
