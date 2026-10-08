// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ”Œ Plugin System â€” Extensibility via plugins
// Load, execute, and manage custom plugins
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, kvListRaw } from "../core/kv.js";

export const PLUGIN_TYPES = {
  MODEL_ADAPTER: "model_adapter",
  TOOL: "tool",
  MIDDLEWARE: "middleware",
  TRANSFORMER: "transformer"
};

export async function registerPlugin(env, { name, type, code, manifest, userId }) {
  const plugin = {
    id: newId("plugin"),
    name,
    type,
    code,
    manifest,
    enabled: false,
    createdBy: userId,
    createdAt: nowIso()
  };
  await kvPut(env, `plugin:${plugin.id}`, plugin);
  return plugin;
}

export async function listPlugins(env) {
  const keys = await kvListRaw(env, { prefix: "plugin:" });
  const plugins = [];
  for (const key of keys.keys) {
    const plugin = await kvGet(env, key.name);
    if (plugin) plugins.push(plugin);
  }
  return plugins;
}

export async function enablePlugin(env, pluginId) {
  const plugin = await kvGet(env, `plugin:${pluginId}`);
  if (!plugin) throw new Error("Plugin not found");
  plugin.enabled = true;
  await kvPut(env, `plugin:${pluginId}`, plugin);
  return plugin;
}

export async function disablePlugin(env, pluginId) {
  const plugin = await kvGet(env, `plugin:${pluginId}`);
  if (!plugin) throw new Error("Plugin not found");
  plugin.enabled = false;
  await kvPut(env, `plugin:${pluginId}`, plugin);
  return plugin;
}

export async function executePlugin(env, pluginId, input) {
  const plugin = await kvGet(env, `plugin:${pluginId}`);
  if (!plugin || !plugin.enabled) throw new Error("Plugin not available");
  
  // In production, this would use Worker's eval or isolate
  // For now, return mock result
  return { output: `Plugin ${plugin.name} executed`, input };
}
