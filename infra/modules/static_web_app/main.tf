resource "azurerm_static_web_app" "main" {
  name                = "stapp-gl-${var.environment}-web"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku_tier            = var.sku_tier
  sku_size            = var.sku_tier

  app_settings = {
    NEXT_PUBLIC_API_BASE_URL           = var.api_base_url
    NEXT_PUBLIC_ENTRA_CLIENT_ID        = var.entra_client_id
    NEXT_PUBLIC_ENTRA_AUTHORITY        = var.entra_authority
    NEXT_PUBLIC_ENTRA_REDIRECT_URI     = var.entra_redirect_uri
    NEXT_PUBLIC_ENTRA_POST_LOGOUT_REDIRECT = var.entra_post_logout_redirect
    NEXT_PUBLIC_ENTRA_SCOPES           = var.entra_scopes
    NEXT_PUBLIC_ENVIRONMENT            = upper(var.environment)
  }

  tags = var.tags
}

resource "azurerm_static_web_app_custom_domain" "main" {
  count = var.custom_domain != "" ? 1 : 0

  static_web_app_id = azurerm_static_web_app.main.id
  domain_name       = var.custom_domain
  validation_type   = "cname-delegation"
}
