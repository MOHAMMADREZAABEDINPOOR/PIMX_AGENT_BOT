// ─────────────────────────────────────────────
// 🔌 Provider Adapter Architecture
// Consistent interface for all AI providers
// ─────────────────────────────────────────────
import { httpJson } from "./client.js";
import { pickKey, buildUrl, authHeaders } from "./providers.js";

/**
 * Base Provider Adapter Interface
 * All provider-specific adapters must implement these methods
 */
export class ProviderAdapter {
  constructor(provider) {
    this.provider = provider;
    this.format = provider.format || "openai";
  }

  /**
   * Authenticate with the provider
   * @returns {Promise<{ok: boolean, error?: string, details?: object}>}
   */
  async authenticate(env) {
    throw new Error("authenticate() must be implemented");
  }

  /**
   * List available models
   * @returns {Promise<{models: Array, error?: string}>}
   */
  async listModels(env) {
    throw new Error("listModels() must be implemented");
  }

  /**
   * Send chat completion request
   * @returns {Promise<{text: string, toolCalls?: Array, usage?: object, error?: string}>}
   */
  async chat(env, model, messages, opts = {}) {
    throw new Error("chat() must be implemented");
  }

  /**
   * Stream chat completion
   * @returns {Promise<{text: string, usage?: object, error?: string}>}
   */
  async stream(env, model, messages, opts = {}) {
    throw new Error("stream() must be implemented");
  }

  /**
   * Health check - verify provider is reachable and functional
   * @returns {Promise<{healthy: boolean, latency?: number, error?: string, details?: object}>}
   */
  async healthCheck(env) {
    throw new Error("healthCheck() must be implemented");
  }

  /**
   * Detect capabilities from provider API
   * @returns {Promise<{capabilities: object, contextWindow?: number, error?: string}>}
   */
  async detectCapabilities(env, model) {
    throw new Error("detectCapabilities() must be implemented");
  }

  /**
   * Parse error response from provider
   * @returns {string} Human-readable error message
   */
  parseError(response) {
    if (response.error) return response.error;
    if (!response.text) return `HTTP ${response.status}`;
    
    try {
      const j = JSON.parse(response.text);
      return String(j.error?.message || j.message || j.detail || response.text).slice(0, 200);
    } catch {
      return response.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200);
    }
  }

  /**
   * Check if error is rate limit related
   * @returns {boolean}
   */
  isRateLimitError(response) {
    if (response.status === 429) return true;
    const text = (response.text || "").toLowerCase();
    return /rate.?limit|quota|too.?many.?requests|429/.test(text);
  }

  /**
   * Check if error is authentication related
   * @returns {boolean}
   */
  isAuthError(response) {
    if (response.status === 401 || response.status === 403) return true;
    const text = (response.text || "").toLowerCase();
    return /unauthorized|invalid.?key|authentication|forbidden|403|401/.test(text);
  }
}

/**
 * OpenAI-Compatible Adapter (works with OpenAI, OpenRouter, Groq, etc.)
 */
export class OpenAIAdapter extends ProviderAdapter {
  constructor(provider) {
    super(provider);
  }

  async authenticate(env) {
    try {
      const { plain: key } = await pickKey(env, this.provider);
      const url = buildUrl(this.provider, "/models", key);
      const headers = authHeaders(this.provider, key);
      const r = await httpJson(url, { headers, timeout: 10000 });
      
      if (r.ok && r.json) {
        return { ok: true, details: { modelCount: (r.json.data || []).length } };
      }
      return { ok: false, error: this.parseError(r) };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  async listModels(env) {
    try {
      const { plain: key } = await pickKey(env, this.provider);
      const headers = authHeaders(this.provider, key);
      
      const candidates = ["/models", "/v1/models", "/models/list"];
      for (const path of candidates) {
        const url = buildUrl(this.provider, path, key);
        const r = await httpJson(url, { headers, timeout: 15000 });
        
        if (r.ok && r.json) {
          const models = Array.isArray(r.json) ? r.json
            : Array.isArray(r.json.data) ? r.json.data
            : [];
          if (models.length) return { models };
        }
      }
      return { models: [], error: "No models endpoint found" };
    } catch (e) {
      return { models: [], error: String(e.message || e) };
    }
  }

  async chat(env, model, messages, opts = {}) {
    // Implementation delegated to existing callChat in client.js
    const { callChat } = await import("./client.js");
    return callChat(env, this.provider, model, messages, opts);
  }

  async stream(env, model, messages, opts = {}) {
    // Implementation delegated to existing callChat with stream option
    const { callChat } = await import("./client.js");
    return callChat(env, this.provider, model, messages, { ...opts, stream: true });
  }

  async healthCheck(env) {
    try {
      const t0 = Date.now();
      const { plain: key } = await pickKey(env, this.provider);
      const url = buildUrl(this.provider, "/models", key);
      const headers = authHeaders(this.provider, key);
      const r = await httpJson(url, { headers, timeout: 8000 });
      const latency = Date.now() - t0;
      
      if (r.ok) {
        return { healthy: true, latency, details: { status: r.status } };
      }
      return { healthy: false, latency, error: this.parseError(r) };
    } catch (e) {
      return { healthy: false, error: String(e.message || e) };
    }
  }

  async detectCapabilities(env, model) {
    try {
      const { plain: key } = await pickKey(env, this.provider);
      const url = buildUrl(this.provider, `/models/${encodeURIComponent(model)}`, key);
      const headers = authHeaders(this.provider, key);
      const r = await httpJson(url, { headers, timeout: 10000 });
      
      if (r.ok && r.json) {
        const capabilities = {};
        const raw = r.json;
        
        // Extract from API response
        if (raw.capabilities) capabilities.declared = raw.capabilities;
        if (raw.supported_generation_methods) capabilities.methods = raw.supported_generation_methods;
        
        const contextWindow = Number(
          raw.context_length || raw.context_window || raw.max_context_length ||
          raw.inputTokenLimit || raw.max_input_tokens || 0
        ) || null;
        
        return { capabilities, contextWindow, raw };
      }
      return { capabilities: {}, contextWindow: null, error: "Model info not available" };
    } catch (e) {
      return { capabilities: {}, contextWindow: null, error: String(e.message || e) };
    }
  }
}

/**
 * Google Gemini Adapter
 */
export class GeminiAdapter extends ProviderAdapter {
  constructor(provider) {
    super(provider);
  }

  async authenticate(env) {
    try {
      const { plain: key } = await pickKey(env, this.provider);
      const url = buildUrl(this.provider, "/models", key);
      const headers = authHeaders(this.provider, key);
      const r = await httpJson(url, { headers, timeout: 10000 });
      
      if (r.ok && r.json && r.json.models) {
        return { ok: true, details: { modelCount: r.json.models.length } };
      }
      return { ok: false, error: this.parseError(r) };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  async listModels(env) {
    try {
      const { plain: key } = await pickKey(env, this.provider);
      const url = buildUrl(this.provider, "/models", key);
      const headers = authHeaders(this.provider, key);
      const r = await httpJson(url, { headers, timeout: 15000 });
      
      if (r.ok && r.json && Array.isArray(r.json.models)) {
        return { models: r.json.models };
      }
      return { models: [], error: this.parseError(r) };
    } catch (e) {
      return { models: [], error: String(e.message || e) };
    }
  }

  async chat(env, model, messages, opts = {}) {
    const { callChat } = await import("./client.js");
    return callChat(env, this.provider, model, messages, opts);
  }

  async stream(env, model, messages, opts = {}) {
    const { callChat } = await import("./client.js");
    return callChat(env, this.provider, model, messages, { ...opts, stream: true });
  }

  async healthCheck(env) {
    try {
      const t0 = Date.now();
      const { plain: key } = await pickKey(env, this.provider);
      const url = buildUrl(this.provider, "/models", key);
      const headers = authHeaders(this.provider, key);
      const r = await httpJson(url, { headers, timeout: 8000 });
      const latency = Date.now() - t0;
      
      if (r.ok && r.json) {
        return { healthy: true, latency, details: { modelCount: (r.json.models || []).length } };
      }
      return { healthy: false, latency, error: this.parseError(r) };
    } catch (e) {
      return { healthy: false, error: String(e.message || e) };
    }
  }

  async detectCapabilities(env, model) {
    try {
      const { plain: key } = await pickKey(env, this.provider);
      const url = buildUrl(this.provider, `/models/${encodeURIComponent(model)}`, key);
      const headers = authHeaders(this.provider, key);
      const r = await httpJson(url, { headers, timeout: 10000 });
      
      if (r.ok && r.json) {
        const raw = r.json;
        const capabilities = {};
        
        if (raw.supportedGenerationMethods) {
          capabilities.methods = raw.supportedGenerationMethods;
        }
        
        const contextWindow = Number(raw.inputTokenLimit || 0) || null;
        
        return { capabilities, contextWindow, raw };
      }
      return { capabilities: {}, contextWindow: null, error: "Model info not available" };
    } catch (e) {
      return { capabilities: {}, contextWindow: null, error: String(e.message || e) };
    }
  }
}

/**
 * Anthropic Adapter
 */
export class AnthropicAdapter extends ProviderAdapter {
  constructor(provider) {
    super(provider);
  }

  async authenticate(env) {
    try {
      const { plain: key } = await pickKey(env, this.provider);
      // Anthropic doesn't have a models list endpoint, so we try a minimal request
      const url = buildUrl(this.provider, "/messages", key);
      const headers = authHeaders(this.provider, key);
      headers["anthropic-version"] = "2023-06-01";
      
      const body = {
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "test" }]
      };
      
      const r = await httpJson(url, { method: "POST", headers, body, timeout: 10000 });
      
      // Even if we hit rate limits, auth is valid
      if (r.ok || r.status === 429) {
        return { ok: true };
      }
      if (r.status === 401 || r.status === 403) {
        return { ok: false, error: "Invalid API key" };
      }
      return { ok: false, error: this.parseError(r) };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  async listModels(env) {
    // Anthropic doesn't provide a models list endpoint
    // Return known models
    return {
      models: [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
        { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
        { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
        { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" }
      ]
    };
  }

  async chat(env, model, messages, opts = {}) {
    const { callChat } = await import("./client.js");
    return callChat(env, this.provider, model, messages, opts);
  }

  async stream(env, model, messages, opts = {}) {
    const { callChat } = await import("./client.js");
    return callChat(env, this.provider, model, messages, { ...opts, stream: true });
  }

  async healthCheck(env) {
    // Use authenticate as health check since Anthropic has no dedicated health endpoint
    const authResult = await this.authenticate(env);
    return {
      healthy: authResult.ok,
      error: authResult.error
    };
  }

  async detectCapabilities(env, model) {
    // Anthropic models have known capabilities
    const capabilities = {
      chat: true,
      streaming: true,
      tools: true,
      vision: /claude-3/.test(model) // Claude 3 models support vision
    };
    
    const contextWindow = /opus/.test(model) ? 200000
      : /sonnet/.test(model) ? 200000
      : /haiku/.test(model) ? 200000
      : null;
    
    return { capabilities, contextWindow };
  }
}

/**
 * Factory function to create appropriate adapter for a provider
 */
export function createAdapter(provider) {
  const format = provider.format || "openai";
  
  switch (format) {
    case "gemini":
      return new GeminiAdapter(provider);
    case "anthropic":
      return new AnthropicAdapter(provider);
    case "openai":
    default:
      return new OpenAIAdapter(provider);
  }
}

/**
 * Helper: Execute adapter method with error handling
 */
export async function executeAdapterMethod(provider, method, ...args) {
  try {
    const adapter = createAdapter(provider);
    if (typeof adapter[method] !== "function") {
      throw new Error(`Method ${method} not found on adapter`);
    }
    return await adapter[method](...args);
  } catch (e) {
    return { error: String(e.message || e) };
  }
}
