// ─────────────────────────────────────────────
// Phase 18: Universal Export/Import - Platform Backup
// ─────────────────────────────────────────────
import { kvGet, nowIso } from "../core/kv.js";
import { audit } from "../core/audit.js";

/**
 * Export entire platform data for a user
 */
export async function exportPlatformData(env, userId, options = {}) {
  const exportData = {
    version: "1.0.0",
    exportedAt: nowIso(),
    userId,
    data: {}
  };
  
  // Import functions from various modules
  const { listProjects, getGraph } = await import("../knowledge/memory.js");
  const { listProviders } = await import("../gateway/providers.js");
  const { listModels } = await import("../gateway/models.js");
  const { listAgents } = await import("../agents/runtime.js");
  const { listCouncilConfigs, listCouncilTemplates } = await import("../gateway/council.js");
  const { listWorkflows, listTasks } = await import("../ops/automation.js");
  const { getRoutingConfig } = await import("../gateway/router.js");
  
  try {
    // Projects
    if (!options.exclude?.includes("projects")) {
      const projects = await listProjects(env, userId);
      exportData.data.projects = projects.map(p => ({
        ...p,
        _exported: true
      }));
    }
    
    // Providers (metadata only, no API keys for security)
    if (!options.exclude?.includes("providers")) {
      const providers = await listProviders(env);
      const userProviders = providers.filter(p => !p.userId || p.userId === userId);
      exportData.data.providers = userProviders.map(p => ({
        id: p.id,
        name: p.name,
        baseURL: p.baseURL,
        format: p.format,
        authMethod: p.authMethod,
        status: p.status,
        enabled: p.enabled,
        tags: p.tags,
        // Note: API keys excluded for security
        _keysExcluded: true,
        _note: "API keys must be re-added after import"
      }));
    }
    
    // Models
    if (!options.exclude?.includes("models")) {
      const models = await listModels(env);
      exportData.data.models = models.map(m => ({
        providerId: m.providerId,
        apiModelId: m.apiModelId,
        displayName: m.displayName,
        capabilities: m.capabilities,
        contextWindow: m.contextWindow,
        pricing: m.pricing,
        tags: m.tags,
        enabled: m.enabled,
        weight: m.weight,
        favorite: m.favorite
      }));
    }
    
    // Agents
    if (!options.exclude?.includes("agents")) {
      const agents = await listAgents(env);
      const userAgents = agents.filter(a => !a.userId || a.userId === userId);
      exportData.data.agents = userAgents.map(a => ({
        ...a,
        runs: undefined, // Exclude run history
        _exported: true
      }));
    }
    
    // Council Configs
    if (!options.exclude?.includes("councils")) {
      const configs = await listCouncilConfigs(env, userId);
      exportData.data.councilConfigs = configs;
      
      const templates = await listCouncilTemplates(env, userId);
      const customTemplates = templates.filter(t => !t.isBuiltin);
      exportData.data.councilTemplates = customTemplates;
    }
    
    // Workflows & Tasks
    if (!options.exclude?.includes("automation")) {
      const workflows = await listWorkflows(env, userId);
      const tasks = await listTasks(env, userId);
      exportData.data.workflows = workflows;
      exportData.data.tasks = tasks;
    }
    
    // Knowledge Graph
    if (!options.exclude?.includes("knowledge")) {
      const graph = await getGraph(env, userId);
      exportData.data.knowledgeGraph = graph;
    }
    
    // Routing Config
    if (!options.exclude?.includes("routing") && userId === 0) { // Admin only
      const routing = await getRoutingConfig(env);
      exportData.data.routingConfig = routing;
    }
    
    // Settings (user-specific)
    if (!options.exclude?.includes("settings")) {
      const settings = await kvGet(env, `user:${userId}:settings`, {});
      exportData.data.settings = settings;
    }
    
  } catch (e) {
    throw new Error(`Export failed: ${e.message}`);
  }
  
  await audit(env, {
    userId,
    action: "platform.export",
    result: "success",
    meta: {
      sections: Object.keys(exportData.data),
      timestamp: exportData.exportedAt
    }
  });
  
  return exportData;
}

/**
 * Import platform data
 */
export async function importPlatformData(env, importData, userId, options = {}) {
  const results = {
    imported: {},
    skipped: {},
    errors: {},
    warnings: []
  };
  
  // Validate import data
  if (!importData.version) {
    throw new Error("Invalid import data: missing version");
  }
  
  if (!importData.data) {
    throw new Error("Invalid import data: missing data");
  }
  
  // Import functions
  const { createProject } = await import("../knowledge/memory.js");
  const { createProvider } = await import("../gateway/providers.js");
  const { upsertModel } = await import("../gateway/models.js");
  const { createAgent } = await import("../agents/runtime.js");
  const { saveCouncilConfig, createCouncilTemplate } = await import("../gateway/council.js");
  const { createWorkflow, createTask } = await import("../ops/automation.js");
  
  try {
    // Import Projects
    if (importData.data.projects && !options.exclude?.includes("projects")) {
      results.imported.projects = 0;
      for (const project of importData.data.projects) {
        try {
          if (options.overwrite || !await kvGet(env, `project:${project.id}`, null)) {
            await createProject(env, { ...project, userId }, userId);
            results.imported.projects++;
          } else {
            results.skipped.projects = (results.skipped.projects || 0) + 1;
          }
        } catch (e) {
          results.errors.projects = (results.errors.projects || []);
          results.errors.projects.push({ id: project.id, error: e.message });
        }
      }
    }
    
    // Import Providers (metadata only)
    if (importData.data.providers && !options.exclude?.includes("providers")) {
      results.imported.providers = 0;
      results.warnings.push("Provider API keys must be manually added after import");
      
      for (const provider of importData.data.providers) {
        try {
          // Only import if provider doesn't exist or overwrite is enabled
          const existing = await kvGet(env, `provider:${provider.id}`, null);
          if (options.overwrite || !existing) {
            // Note: Cannot import API keys for security
            await createProvider(env, {
              name: provider.name,
              baseURL: provider.baseURL,
              format: provider.format,
              authMethod: provider.authMethod,
              enabled: false, // Disabled until keys are added
              tags: provider.tags
            }, userId);
            results.imported.providers++;
          } else {
            results.skipped.providers = (results.skipped.providers || 0) + 1;
          }
        } catch (e) {
          results.errors.providers = (results.errors.providers || []);
          results.errors.providers.push({ id: provider.id, error: e.message });
        }
      }
    }
    
    // Import Models
    if (importData.data.models && !options.exclude?.includes("models")) {
      results.imported.models = 0;
      for (const model of importData.data.models) {
        try {
          const provider = await kvGet(env, `provider:${model.providerId}`, null);
          if (!provider) {
            results.warnings.push(`Model ${model.apiModelId} skipped: provider ${model.providerId} not found`);
            continue;
          }
          
          await upsertModel(env, provider, model.apiModelId, {
            displayName: model.displayName,
            capabilities: model.capabilities,
            contextWindow: model.contextWindow,
            pricing: model.pricing,
            tags: model.tags,
            enabled: model.enabled,
            weight: model.weight
          });
          results.imported.models++;
        } catch (e) {
          results.errors.models = (results.errors.models || []);
          results.errors.models.push({ id: model.apiModelId, error: e.message });
        }
      }
    }
    
    // Import Agents
    if (importData.data.agents && !options.exclude?.includes("agents")) {
      results.imported.agents = 0;
      for (const agent of importData.data.agents) {
        try {
          await createAgent(env, { ...agent, userId }, userId);
          results.imported.agents++;
        } catch (e) {
          results.errors.agents = (results.errors.agents || []);
          results.errors.agents.push({ id: agent.id, error: e.message });
        }
      }
    }
    
    // Import Council Configs
    if (importData.data.councilConfigs && !options.exclude?.includes("councils")) {
      results.imported.councilConfigs = 0;
      for (const config of importData.data.councilConfigs) {
        try {
          await saveCouncilConfig(env, { ...config, userId }, userId);
          results.imported.councilConfigs++;
        } catch (e) {
          results.errors.councilConfigs = (results.errors.councilConfigs || []);
          results.errors.councilConfigs.push({ id: config.id, error: e.message });
        }
      }
    }
    
    // Import Custom Templates
    if (importData.data.councilTemplates && !options.exclude?.includes("councils")) {
      results.imported.councilTemplates = 0;
      for (const template of importData.data.councilTemplates) {
        try {
          await createCouncilTemplate(env, { ...template, userId }, userId);
          results.imported.councilTemplates++;
        } catch (e) {
          results.errors.councilTemplates = (results.errors.councilTemplates || []);
          results.errors.councilTemplates.push({ id: template.id, error: e.message });
        }
      }
    }
    
    // Import Workflows
    if (importData.data.workflows && !options.exclude?.includes("automation")) {
      results.imported.workflows = 0;
      for (const workflow of importData.data.workflows) {
        try {
          await createWorkflow(env, { ...workflow, userId }, userId);
          results.imported.workflows++;
        } catch (e) {
          results.errors.workflows = (results.errors.workflows || []);
          results.errors.workflows.push({ id: workflow.id, error: e.message });
        }
      }
    }
    
    // Import Tasks
    if (importData.data.tasks && !options.exclude?.includes("automation")) {
      results.imported.tasks = 0;
      for (const task of importData.data.tasks) {
        try {
          await createTask(env, { ...task, userId }, userId);
          results.imported.tasks++;
        } catch (e) {
          results.errors.tasks = (results.errors.tasks || []);
          results.errors.tasks.push({ id: task.id, error: e.message });
        }
      }
    }
    
  } catch (e) {
    throw new Error(`Import failed: ${e.message}`);
  }
  
  await audit(env, {
    userId,
    action: "platform.import",
    result: "success",
    meta: {
      imported: Object.keys(results.imported),
      totalItems: Object.values(results.imported).reduce((sum, count) => sum + count, 0)
    }
  });
  
  return results;
}

/**
 * Export specific resource type
 */
export async function exportResource(env, resourceType, resourceIds, userId) {
  const exportData = {
    version: "1.0.0",
    resourceType,
    exportedAt: nowIso(),
    userId,
    resources: []
  };
  
  switch (resourceType) {
    case "project":
      const { getProject } = await import("../knowledge/memory.js");
      for (const id of resourceIds) {
        const project = await getProject(env, id);
        if (project) exportData.resources.push(project);
      }
      break;
      
    case "agent":
      const { getAgent } = await import("../agents/runtime.js");
      for (const id of resourceIds) {
        const agent = await getAgent(env, id);
        if (agent) exportData.resources.push(agent);
      }
      break;
      
    case "workflow":
      const { getWorkflow } = await import("../ops/automation.js");
      for (const id of resourceIds) {
        const workflow = await getWorkflow(env, id);
        if (workflow) exportData.resources.push(workflow);
      }
      break;
      
    default:
      throw new Error(`Unsupported resource type: ${resourceType}`);
  }
  
  return exportData;
}

/**
 * Import specific resources
 */
export async function importResource(env, resourceType, resources, userId, options = {}) {
  const results = { imported: 0, skipped: 0, errors: [] };
  
  switch (resourceType) {
    case "project":
      const { createProject } = await import("../knowledge/memory.js");
      for (const resource of resources) {
        try {
          await createProject(env, { ...resource, userId }, userId);
          results.imported++;
        } catch (e) {
          results.errors.push({ id: resource.id, error: e.message });
        }
      }
      break;
      
    case "agent":
      const { createAgent } = await import("../agents/runtime.js");
      for (const resource of resources) {
        try {
          await createAgent(env, { ...resource, userId }, userId);
          results.imported++;
        } catch (e) {
          results.errors.push({ id: resource.id, error: e.message });
        }
      }
      break;
      
    case "workflow":
      const { createWorkflow } = await import("../ops/automation.js");
      for (const resource of resources) {
        try {
          await createWorkflow(env, { ...resource, userId }, userId);
          results.imported++;
        } catch (e) {
          results.errors.push({ id: resource.id, error: e.message });
        }
      }
      break;
      
    default:
      throw new Error(`Unsupported resource type: ${resourceType}`);
  }
  
  return results;
}
