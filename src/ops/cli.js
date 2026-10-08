// ─────────────────────────────────────────────
// 🖥️  CLI Tool Metadata — Command definitions for CLI generation
// Used to auto-generate CLI tools for automation
// ─────────────────────────────────────────────

export const CLI_COMMANDS = {
  providers: {
    list: { description: "List all providers", endpoint: "/providers" },
    create: { description: "Create new provider", endpoint: "/providers", method: "POST" },
    test: { description: "Test provider connection", endpoint: "/providers/:id/test", method: "POST" }
  },
  models: {
    list: { description: "List all models", endpoint: "/models" },
    test: { description: "Test model", endpoint: "/models/:id/test", method: "POST" },
    benchmark: { description: "Run benchmark", endpoint: "/models/benchmark", method: "POST" }
  },
  agents: {
    list: { description: "List agents", endpoint: "/agents" },
    run: { description: "Run agent", endpoint: "/agents/:id/run", method: "POST" }
  },
  council: {
    run: { description: "Run council", endpoint: "/council/run", method: "POST" }
  }
};

export function generateCLISpec() {
  return {
    name: "pimx",
    version: "1.0.0",
    commands: CLI_COMMANDS,
    baseUrl: "/api"
  };
}
