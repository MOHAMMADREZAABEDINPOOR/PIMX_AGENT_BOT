// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸª Webhook System â€” Event-driven notifications
// Register, trigger, retry, and monitor webhooks
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, kvListRaw } from "../core/kv.js";
import { audit } from "../core/audit.js";
import crypto from "crypto";

// â”€â”€ Webhook Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const WEBHOOK_EVENTS = {
  // Model events
  "model.created": "New model added",
  "model.updated": "Model configuration updated",
  "model.deleted": "Model removed",
  "model.tested": "Model test completed",
  
  // Provider events
  "provider.created": "New provider added",
  "provider.updated": "Provider configuration updated",
  "provider.health_changed": "Provider health status changed",
  
  // Agent events
  "agent.run.started": "Agent execution started",
  "agent.run.completed": "Agent execution completed",
  "agent.run.failed": "Agent execution failed",
  
  // Budget events
  "budget.threshold_reached": "Budget threshold crossed",
  "budget.exceeded": "Budget limit exceeded",
  
  // Evaluation events
  "eval.run.completed": "Evaluation run finished",
  "eval.regression_detected": "Regression detected in evaluation",
  
  // System events
  "system.alert": "System alert triggered",
  "system.health_degraded": "System health degraded"
};

// â”€â”€ Webhook Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create webhook
 */
export async function createWebhook(env, {
  url,
  events,
  secret = null,
  enabled = true,
  description = "",
  userId
}) {
  // Validate events
  for (const event of events) {
    if (!WEBHOOK_EVENTS[event]) {
      throw new Error(`Unknown event: ${event}`);
    }
  }

  const webhook = {
    id: newId("webhook"),
    url,
    events,
    secret: secret || generateSecret(),
    enabled,
    description,
    createdBy: userId,
    createdAt: nowIso(),
    stats: {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      lastTriggered: null,
      lastSuccess: null,
      lastFailure: null
    }
  };

  await kvPut(env, `webhook:${webhook.id}`, webhook);
  await audit(env, { userId, action: "webhook.create", resource: webhook.id, meta: { url, events: events.length } });

  return webhook;
}

/**
 * Generate webhook secret
 */
function generateSecret() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Get webhook
 */
export async function getWebhook(env, webhookId) {
  return await kvGet(env, `webhook:${webhookId}`);
}

/**
 * List webhooks
 */
export async function listWebhooks(env, { userId = null, event = null } = {}) {
  const keys = await kvListRaw(env, { prefix: "webhook:" });
  const webhooks = [];

  for (const key of keys.keys) {
    const webhook = await kvGet(env, key.name);
    if (!webhook) continue;
    if (userId && webhook.createdBy !== userId) continue;
    if (event && !webhook.events.includes(event)) continue;
    webhooks.push(webhook);
  }

  return webhooks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Update webhook
 */
export async function updateWebhook(env, webhookId, updates, userId) {
  const webhook = await getWebhook(env, webhookId);
  if (!webhook) throw new Error("Webhook not found");

  const allowed = ["url", "events", "enabled", "description"];
  for (const key of allowed) {
    if (updates[key] !== undefined) webhook[key] = updates[key];
  }

  webhook.updatedAt = nowIso();
  await kvPut(env, `webhook:${webhookId}`, webhook);
  await audit(env, { userId, action: "webhook.update", resource: webhookId, meta: updates });

  return webhook;
}

/**
 * Delete webhook
 */
export async function deleteWebhook(env, webhookId, userId) {
  const webhook = await getWebhook(env, webhookId);
  if (!webhook) return false;

  await kvPut(env, `webhook:${webhookId}`, null);
  await audit(env, { userId, action: "webhook.delete", resource: webhookId });

  return true;
}

/**
 * Rotate webhook secret
 */
export async function rotateWebhookSecret(env, webhookId, userId) {
  const webhook = await getWebhook(env, webhookId);
  if (!webhook) throw new Error("Webhook not found");

  const oldSecret = webhook.secret;
  webhook.secret = generateSecret();
  webhook.secretRotatedAt = nowIso();

  await kvPut(env, `webhook:${webhookId}`, webhook);
  await audit(env, { userId, action: "webhook.secret_rotate", resource: webhookId });

  return { secret: webhook.secret, rotatedAt: webhook.secretRotatedAt };
}

// â”€â”€ Webhook Triggering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Trigger webhook event
 */
export async function triggerWebhookEvent(env, { event, data, metadata = {} }) {
  if (!WEBHOOK_EVENTS[event]) {
    throw new Error(`Unknown event: ${event}`);
  }

  // Find webhooks subscribed to this event
  const webhooks = await listWebhooks(env, { event });
  
  if (webhooks.length === 0) {
    return { triggered: 0, webhooks: [] };
  }

  const results = [];

  for (const webhook of webhooks) {
    if (!webhook.enabled) continue;

    const result = await deliverWebhook(env, webhook, {
      event,
      data,
      metadata,
      timestamp: nowIso()
    });

    results.push({
      webhookId: webhook.id,
      url: webhook.url,
      success: result.success,
      status: result.status,
      error: result.error
    });
  }

  return {
    event,
    triggered: results.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    webhooks: results
  };
}

/**
 * Deliver webhook payload
 */
async function deliverWebhook(env, webhook, payload) {
  const deliveryId = newId("delivery");
  
  // Create signature
  const signature = createWebhookSignature(payload, webhook.secret);

  // Prepare request
  const requestPayload = {
    id: deliveryId,
    webhook_id: webhook.id,
    ...payload
  };

  const delivery = {
    id: deliveryId,
    webhookId: webhook.id,
    event: payload.event,
    payload: requestPayload,
    status: "pending",
    attempts: 0,
    createdAt: nowIso()
  };

  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Delivery": deliveryId,
        "X-Webhook-Event": payload.event,
        "User-Agent": "PIMXAGENT-Webhooks/1.0"
      },
      body: JSON.stringify(requestPayload)
    });

    const success = response.ok;
    delivery.status = success ? "delivered" : "failed";
    delivery.statusCode = response.status;
    delivery.attempts = 1;
    delivery.deliveredAt = nowIso();

    if (!success) {
      delivery.error = await response.text();
    }

    // Update webhook stats
    webhook.stats.totalCalls++;
    webhook.stats.lastTriggered = nowIso();
    
    if (success) {
      webhook.stats.successfulCalls++;
      webhook.stats.lastSuccess = nowIso();
    } else {
      webhook.stats.failedCalls++;
      webhook.stats.lastFailure = nowIso();
      
      // Queue for retry if delivery failed
      if (response.status >= 500) {
        await queueWebhookRetry(env, delivery);
      }
    }

    await kvPut(env, `webhook:${webhook.id}`, webhook);

  } catch (error) {
    delivery.status = "failed";
    delivery.error = error.message;
    delivery.attempts = 1;
    
    webhook.stats.totalCalls++;
    webhook.stats.failedCalls++;
    webhook.stats.lastFailure = nowIso();
    await kvPut(env, `webhook:${webhook.id}`, webhook);

    // Queue for retry
    await queueWebhookRetry(env, delivery);
  }

  // Store delivery record
  await kvPut(env, `webhook_delivery:${deliveryId}`, delivery, { expirationTtl: 86400 * 7 });

  return {
    success: delivery.status === "delivered",
    status: delivery.statusCode,
    error: delivery.error
  };
}

/**
 * Create webhook signature (HMAC-SHA256)
 */
function createWebhookSignature(payload, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest("hex");
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = createWebhookSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// â”€â”€ Retry Logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Queue webhook for retry
 */
async function queueWebhookRetry(env, delivery) {
  const retry = {
    ...delivery,
    retryCount: 0,
    nextRetryAt: new Date(Date.now() + 60000).toISOString(), // 1 minute
    maxRetries: 3
  };

  await kvPut(env, `webhook_retry:${delivery.id}`, retry, { expirationTtl: 86400 });
}

/**
 * Process webhook retries
 */
export async function processWebhookRetries(env) {
  const keys = await kvListRaw(env, { prefix: "webhook_retry:" });
  const results = [];

  for (const key of keys.keys) {
    const retry = await kvGet(env, key.name);
    if (!retry) continue;

    // Check if it's time to retry
    if (new Date(retry.nextRetryAt) > new Date()) continue;

    // Check retry limit
    if (retry.retryCount >= retry.maxRetries) {
      await kvPut(env, key.name, null); // Remove from queue
      continue;
    }

    // Get webhook
    const webhook = await getWebhook(env, retry.webhookId);
    if (!webhook || !webhook.enabled) {
      await kvPut(env, key.name, null);
      continue;
    }

    // Retry delivery
    const result = await deliverWebhook(env, webhook, retry.payload);

    retry.retryCount++;
    retry.attempts = retry.retryCount + 1;

    if (result.success) {
      // Success - remove from queue
      await kvPut(env, key.name, null);
      results.push({ deliveryId: retry.id, success: true, attempts: retry.attempts });
    } else {
      // Failed - schedule next retry with exponential backoff
      const backoff = Math.pow(2, retry.retryCount) * 60000; // 1, 2, 4 minutes
      retry.nextRetryAt = new Date(Date.now() + backoff).toISOString();
      await kvPut(env, key.name, retry, { expirationTtl: 86400 });
      results.push({ deliveryId: retry.id, success: false, attempts: retry.attempts, nextRetry: retry.nextRetryAt });
    }
  }

  return results;
}

// â”€â”€ Webhook Deliveries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get webhook delivery
 */
export async function getWebhookDelivery(env, deliveryId) {
  return await kvGet(env, `webhook_delivery:${deliveryId}`);
}

/**
 * List webhook deliveries
 */
export async function listWebhookDeliveries(env, { webhookId = null, event = null, status = null, limit = 50 } = {}) {
  const keys = await kvListRaw(env, { prefix: "webhook_delivery:", limit: 1000 });
  const deliveries = [];

  for (const key of keys.keys) {
    const delivery = await kvGet(env, key.name);
    if (!delivery) continue;
    if (webhookId && delivery.webhookId !== webhookId) continue;
    if (event && delivery.event !== event) continue;
    if (status && delivery.status !== status) continue;
    deliveries.push(delivery);
  }

  return deliveries
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

/**
 * Retry failed delivery manually
 */
export async function retryWebhookDelivery(env, deliveryId, userId) {
  const delivery = await getWebhookDelivery(env, deliveryId);
  if (!delivery) throw new Error("Delivery not found");

  const webhook = await getWebhook(env, delivery.webhookId);
  if (!webhook) throw new Error("Webhook not found");

  const result = await deliverWebhook(env, webhook, delivery.payload);
  
  await audit(env, { userId, action: "webhook.delivery.retry", resource: deliveryId, meta: { success: result.success } });

  return result;
}

// â”€â”€ Webhook Statistics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get webhook statistics
 */
export async function getWebhookStats(env, { webhookId = null, days = 7 } = {}) {
  const cutoff = Date.now() - (days * 86400000);
  const deliveries = await listWebhookDeliveries(env, { webhookId, limit: 10000 });
  
  const recentDeliveries = deliveries.filter(d => 
    new Date(d.createdAt).getTime() >= cutoff
  );

  const stats = {
    total: recentDeliveries.length,
    delivered: recentDeliveries.filter(d => d.status === "delivered").length,
    failed: recentDeliveries.filter(d => d.status === "failed").length,
    pending: recentDeliveries.filter(d => d.status === "pending").length,
    byEvent: {}
  };

  stats.successRate = stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0;

  // Group by event
  for (const delivery of recentDeliveries) {
    if (!stats.byEvent[delivery.event]) {
      stats.byEvent[delivery.event] = { total: 0, delivered: 0, failed: 0 };
    }
    stats.byEvent[delivery.event].total++;
    if (delivery.status === "delivered") stats.byEvent[delivery.event].delivered++;
    if (delivery.status === "failed") stats.byEvent[delivery.event].failed++;
  }

  return stats;
}

/**
 * Test webhook
 */
export async function testWebhook(env, webhookId, userId) {
  const webhook = await getWebhook(env, webhookId);
  if (!webhook) throw new Error("Webhook not found");

  const testPayload = {
    event: "webhook.test",
    data: { message: "This is a test webhook delivery" },
    metadata: { test: true, triggeredBy: userId },
    timestamp: nowIso()
  };

  const result = await deliverWebhook(env, webhook, testPayload);
  
  await audit(env, { userId, action: "webhook.test", resource: webhookId, meta: { success: result.success } });

  return result;
}
