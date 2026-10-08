// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ”‘ Single Sign-On (SSO) â€” OAuth 2.0 & SAML 2.0
// OAuth providers: Google, Microsoft, GitHub
// SAML providers: Okta, Azure AD, OneLogin
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, kvListRaw } from "./kv.js";
import { audit } from "./audit.js";

// â”€â”€ SSO Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create SSO configuration
 */
export async function createSsoConfig(env, {
  tenantId,
  provider, // "google", "microsoft", "github", "saml"
  protocol, // "oauth2", "saml2"
  settings,
  createdBy
}) {
  const config = {
    id: newId("sso"),
    tenantId,
    provider,
    protocol,
    settings: {
      ...settings,
      enabled: true
    },
    createdBy,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  // Validate settings based on protocol
  if (protocol === "oauth2") {
    validateOAuth2Settings(config.settings);
  } else if (protocol === "saml2") {
    validateSAML2Settings(config.settings);
  }

  await kvPut(env, `sso_config:${tenantId}:${config.id}`, config);
  await audit(env, { userId: createdBy, action: "sso.config.create", resource: config.id, meta: { provider, tenantId } });

  return config;
}

/**
 * Get SSO configuration
 */
export async function getSsoConfig(env, tenantId, configId) {
  return await kvGet(env, `sso_config:${tenantId}:${configId}`);
}

/**
 * List SSO configurations for tenant
 */
export async function listSsoConfigs(env, tenantId) {
  const keys = await kvListRaw(env, { prefix: `sso_config:${tenantId}:` });
  const configs = [];

  for (const key of keys.keys) {
    const config = await kvGet(env, key.name);
    if (config) configs.push(sanitizeSsoConfig(config));
  }

  return configs;
}

/**
 * Update SSO configuration
 */
export async function updateSsoConfig(env, tenantId, configId, updates, updatedBy) {
  const config = await getSsoConfig(env, tenantId, configId);
  if (!config) throw new Error("SSO configuration not found");

  if (updates.settings) {
    config.settings = { ...config.settings, ...updates.settings };
  }

  config.updatedAt = nowIso();
  await kvPut(env, `sso_config:${tenantId}:${configId}`, config);
  await audit(env, { userId: updatedBy, action: "sso.config.update", resource: configId, meta: updates });

  return config;
}

/**
 * Delete SSO configuration
 */
export async function deleteSsoConfig(env, tenantId, configId, deletedBy) {
  await kvPut(env, `sso_config:${tenantId}:${configId}`, null);
  await audit(env, { userId: deletedBy, action: "sso.config.delete", resource: configId });
  return true;
}

// â”€â”€ OAuth 2.0 Implementation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const OAUTH_PROVIDERS = {
  google: {
    name: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scopes: ["openid", "email", "profile"]
  },
  microsoft: {
    name: "Microsoft",
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/v1.0/me",
    scopes: ["openid", "email", "profile"]
  },
  github: {
    name: "GitHub",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scopes: ["read:user", "user:email"]
  }
};

/**
 * Validate OAuth2 settings
 */
function validateOAuth2Settings(settings) {
  const required = ["clientId", "clientSecret", "redirectUri"];
  for (const field of required) {
    if (!settings[field]) {
      throw new Error(`Missing required OAuth2 setting: ${field}`);
    }
  }
}

/**
 * Generate OAuth2 authorization URL
 */
export function generateOAuthUrl(provider, config, state) {
  const providerConfig = OAUTH_PROVIDERS[provider];
  if (!providerConfig) throw new Error(`Unknown OAuth provider: ${provider}`);

  const params = new URLSearchParams({
    client_id: config.settings.clientId,
    redirect_uri: config.settings.redirectUri,
    response_type: "code",
    scope: (config.settings.scopes || providerConfig.scopes).join(" "),
    state
  });

  return `${providerConfig.authUrl}?${params.toString()}`;
}

/**
 * Exchange OAuth2 code for token
 */
export async function exchangeOAuthCode(provider, config, code) {
  const providerConfig = OAUTH_PROVIDERS[provider];
  if (!providerConfig) throw new Error(`Unknown OAuth provider: ${provider}`);

  const body = new URLSearchParams({
    client_id: config.settings.clientId,
    client_secret: config.settings.clientSecret,
    redirect_uri: config.settings.redirectUri,
    code,
    grant_type: "authorization_code"
  });

  const response = await fetch(providerConfig.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * Get OAuth user info
 */
export async function getOAuthUserInfo(provider, accessToken) {
  const providerConfig = OAUTH_PROVIDERS[provider];
  if (!providerConfig) throw new Error(`Unknown OAuth provider: ${provider}`);

  const response = await fetch(providerConfig.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  const data = await response.json();

  // Normalize user info
  return {
    id: data.id || data.sub,
    email: data.email,
    name: data.name || `${data.given_name || ""} ${data.family_name || ""}`.trim(),
    picture: data.picture || data.avatar_url
  };
}

// â”€â”€ SAML 2.0 Implementation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Validate SAML2 settings
 */
function validateSAML2Settings(settings) {
  const required = ["entityId", "ssoUrl", "certificate"];
  for (const field of required) {
    if (!settings[field]) {
      throw new Error(`Missing required SAML2 setting: ${field}`);
    }
  }
}

/**
 * Generate SAML authentication request
 */
export function generateSamlAuthRequest(config, requestId, callbackUrl) {
  const now = new Date().toISOString();

  // Note: This is a simplified SAML request. Production use requires proper XML signing.
  const samlRequest = `
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${now}"
  Destination="${config.settings.ssoUrl}"
  AssertionConsumerServiceURL="${callbackUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${config.settings.entityId}</saml:Issuer>
</samlp:AuthnRequest>
`.trim();

  // Base64 encode the request
  const encoded = btoa(samlRequest);

  // Generate redirect URL
  const params = new URLSearchParams({
    SAMLRequest: encoded,
    RelayState: requestId
  });

  return `${config.settings.ssoUrl}?${params.toString()}`;
}

/**
 * Parse SAML response
 */
export async function parseSamlResponse(samlResponse, config) {
  // Note: This is a placeholder. Production SAML parsing requires:
  // 1. XML parsing
  // 2. Signature validation using certificate
  // 3. Assertion validation (timestamps, audience, etc.)
  
  // For now, return mock data structure
  // In production, use a proper SAML library
  
  throw new Error("SAML response parsing requires XML parser - use saml2-js or passport-saml library");
}

// â”€â”€ SSO Session Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create SSO session
 */
export async function createSsoSession(env, {
  userId,
  tenantId,
  provider,
  externalUserId,
  email,
  name,
  metadata = {}
}) {
  const session = {
    id: newId("sso_session"),
    userId,
    tenantId,
    provider,
    externalUserId,
    email,
    name,
    metadata,
    createdAt: nowIso(),
    lastUsed: nowIso(),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() // 30 days
  };

  await kvPut(env, `sso_session:${session.id}`, session, { expirationTtl: 30 * 86400 });
  await audit(env, { userId, action: "sso.login", resource: tenantId, meta: { provider, email } });

  return session;
}

/**
 * Get SSO session
 */
export async function getSsoSession(env, sessionId) {
  return await kvGet(env, `sso_session:${sessionId}`);
}

/**
 * Link external identity to user
 */
export async function linkExternalIdentity(env, {
  userId,
  tenantId,
  provider,
  externalUserId,
  email,
  metadata = {}
}) {
  const identity = {
    userId,
    tenantId,
    provider,
    externalUserId,
    email,
    metadata,
    linkedAt: nowIso()
  };

  await kvPut(env, `external_identity:${provider}:${externalUserId}`, identity);
  await kvPut(env, `user_identity:${userId}:${provider}`, identity);

  return identity;
}

/**
 * Get user by external identity
 */
export async function getUserByExternalIdentity(env, provider, externalUserId) {
  const identity = await kvGet(env, `external_identity:${provider}:${externalUserId}`);
  return identity?.userId || null;
}

/**
 * Get user's external identities
 */
export async function getUserExternalIdentities(env, userId) {
  const keys = await kvListRaw(env, { prefix: `user_identity:${userId}:` });
  const identities = [];

  for (const key of keys.keys) {
    const identity = await kvGet(env, key.name);
    if (identity) identities.push(sanitizeIdentity(identity));
  }

  return identities;
}

/**
 * Unlink external identity
 */
export async function unlinkExternalIdentity(env, userId, provider) {
  const identity = await kvGet(env, `user_identity:${userId}:${provider}`);
  if (!identity) return false;

  await kvPut(env, `external_identity:${provider}:${identity.externalUserId}`, null);
  await kvPut(env, `user_identity:${userId}:${provider}`, null);

  return true;
}

// â”€â”€ SSO Flow Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Initiate SSO login
 */
export async function initiateSsoLogin(env, tenantId, configId, callbackUrl) {
  const config = await getSsoConfig(env, tenantId, configId);
  if (!config || !config.settings.enabled) {
    throw new Error("SSO configuration not found or disabled");
  }

  const state = newId("state");
  
  // Store state for validation
  await kvPut(env, `sso_state:${state}`, {
    tenantId,
    configId,
    callbackUrl,
    createdAt: Date.now()
  }, { expirationTtl: 600 }); // 10 minutes

  if (config.protocol === "oauth2") {
    return {
      url: generateOAuthUrl(config.provider, config, state),
      state
    };
  } else if (config.protocol === "saml2") {
    const requestId = newId("saml_req");
    return {
      url: generateSamlAuthRequest(config, requestId, callbackUrl),
      state,
      requestId
    };
  }

  throw new Error(`Unsupported SSO protocol: ${config.protocol}`);
}

/**
 * Complete SSO login (callback)
 */
export async function completeSsoLogin(env, { state, code, samlResponse }) {
  // Validate state
  const stateData = await kvGet(env, `sso_state:${state}`);
  if (!stateData) throw new Error("Invalid or expired state");

  const config = await getSsoConfig(env, stateData.tenantId, stateData.configId);
  if (!config) throw new Error("SSO configuration not found");

  let userInfo;

  if (config.protocol === "oauth2" && code) {
    // Exchange code for token
    const tokenData = await exchangeOAuthCode(config.provider, config, code);
    
    // Get user info
    userInfo = await getOAuthUserInfo(config.provider, tokenData.access_token);
  } else if (config.protocol === "saml2" && samlResponse) {
    // Parse SAML response
    userInfo = await parseSamlResponse(samlResponse, config);
  } else {
    throw new Error("Invalid SSO callback parameters");
  }

  // Find or create user
  let userId = await getUserByExternalIdentity(env, config.provider, userInfo.id);
  
  if (!userId) {
    // Create new user
    userId = newId("user");
    await linkExternalIdentity(env, {
      userId,
      tenantId: stateData.tenantId,
      provider: config.provider,
      externalUserId: userInfo.id,
      email: userInfo.email,
      metadata: { name: userInfo.name, picture: userInfo.picture }
    });
  }

  // Create session
  const session = await createSsoSession(env, {
    userId,
    tenantId: stateData.tenantId,
    provider: config.provider,
    externalUserId: userInfo.id,
    email: userInfo.email,
    name: userInfo.name
  });

  // Clean up state
  await kvPut(env, `sso_state:${state}`, null);

  return {
    session,
    user: { userId, email: userInfo.email, name: userInfo.name }
  };
}

// â”€â”€ Utility Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Sanitize SSO config (remove secrets)
 */
function sanitizeSsoConfig(config) {
  const safe = { ...config };
  if (safe.settings) {
    const { clientSecret, certificate, privateKey, ...safeSettings } = safe.settings;
    safe.settings = safeSettings;
  }
  return safe;
}

/**
 * Sanitize external identity (remove sensitive data)
 */
function sanitizeIdentity(identity) {
  const { metadata, ...safe } = identity;
  return safe;
}

export { OAUTH_PROVIDERS };
