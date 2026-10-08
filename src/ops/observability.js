// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ“Š Observability Stack â€” OpenTelemetry Integration
// Traces, Metrics, Logs, Distributed Tracing
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, kvListRaw } from "../core/kv.js";

// â”€â”€ Trace Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Start a new trace span
 */
export async function startSpan(env, { name, parentSpanId = null, traceId = null, attributes = {}, userId = null }) {
  const span = {
    id: newId("span"),
    traceId: traceId || newId("trace"),
    parentSpanId,
    name,
    startTime: Date.now(),
    endTime: null,
    duration: null,
    status: "active",
    attributes: {
      ...attributes,
      ...(userId ? { "user.id": userId } : {})
    },
    events: [],
    links: []
  };

  await kvPut(env, `span:${span.id}`, span);
  
  // Add to trace index
  if (!parentSpanId) {
    await kvPut(env, `trace:${span.traceId}`, {
      id: span.traceId,
      rootSpanId: span.id,
      startTime: span.startTime,
      status: "active",
      spanCount: 1
    });
  }

  return span;
}

/**
 * End a trace span
 */
export async function endSpan(env, spanId, { status = "ok", error = null } = {}) {
  const span = await kvGet(env, `span:${spanId}`);
  if (!span) throw new Error(`Span ${spanId} not found`);

  span.endTime = Date.now();
  span.duration = span.endTime - span.startTime;
  span.status = status;
  if (error) span.attributes["error.message"] = String(error);

  await kvPut(env, `span:${spanId}`, span);

  // Update trace
  const trace = await kvGet(env, `trace:${span.traceId}`);
  if (trace) {
    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    if (status === "error") trace.status = "error";
    else if (trace.status === "active") trace.status = "ok";
    await kvPut(env, `trace:${span.traceId}`, trace);
  }

  return span;
}

/**
 * Add event to span
 */
export async function addSpanEvent(env, spanId, { name, attributes = {} }) {
  const span = await kvGet(env, `span:${spanId}`);
  if (!span) throw new Error(`Span ${spanId} not found`);

  span.events.push({
    name,
    timestamp: Date.now(),
    attributes
  });

  await kvPut(env, `span:${spanId}`, span);
  return span;
}

/**
 * Get trace with all spans
 */
export async function getTrace(env, traceId) {
  const trace = await kvGet(env, `trace:${traceId}`);
  if (!trace) return null;

  // Get all spans for this trace
  const spanKeys = await kvListRaw(env, { prefix: "span:" });
  const spans = [];
  for (const key of spanKeys.keys) {
    const span = await kvGet(env, key.name);
    if (span && span.traceId === traceId) {
      spans.push(span);
    }
  }

  return {
    ...trace,
    spans: spans.sort((a, b) => a.startTime - b.startTime)
  };
}

/**
 * List recent traces
 */
export async function listTraces(env, { limit = 50, status = null, userId = null } = {}) {
  const traceKeys = await kvListRaw(env, { prefix: "trace:", limit: 1000 });
  const traces = [];

  for (const key of traceKeys.keys) {
    const trace = await kvGet(env, key.name);
    if (!trace) continue;
    
    if (status && trace.status !== status) continue;
    if (userId) {
      // Check if any span in trace has this userId
      const rootSpan = await kvGet(env, `span:${trace.rootSpanId}`);
      if (!rootSpan || rootSpan.attributes?.["user.id"] !== userId) continue;
    }

    traces.push(trace);
  }

  return traces
    .sort((a, b) => b.startTime - a.startTime)
    .slice(0, limit);
}

// â”€â”€ Metrics Collection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const METRIC_TYPES = {
  COUNTER: "counter",
  GAUGE: "gauge",
  HISTOGRAM: "histogram"
};

/**
 * Record a metric
 */
export async function recordMetric(env, { name, value, type = "counter", labels = {}, timestamp = null }) {
  const metric = {
    id: newId("metric"),
    name,
    value,
    type,
    labels,
    timestamp: timestamp || Date.now()
  };

  // Store metric
  await kvPut(env, `metric:${metric.id}`, metric);

  // Update aggregated metrics
  const aggKey = `metric_agg:${name}:${JSON.stringify(labels)}`;
  const agg = await kvGet(env, aggKey) || {
    name,
    type,
    labels,
    count: 0,
    sum: 0,
    min: Infinity,
    max: -Infinity,
    lastValue: null,
    lastUpdated: null
  };

  if (type === "counter") {
    agg.sum += value;
    agg.count += 1;
  } else if (type === "gauge") {
    agg.lastValue = value;
  } else if (type === "histogram") {
    agg.sum += value;
    agg.count += 1;
    agg.min = Math.min(agg.min, value);
    agg.max = Math.max(agg.max, value);
  }

  agg.lastUpdated = Date.now();
  await kvPut(env, aggKey, agg, { expirationTtl: 86400 * 30 }); // Keep for 30 days

  return metric;
}

/**
 * Get metric aggregations
 */
export async function getMetricAggregations(env, { name = null, labels = {} } = {}) {
  const prefix = name ? `metric_agg:${name}:` : "metric_agg:";
  const keys = await kvListRaw(env, { prefix, limit: 1000 });
  const aggregations = [];

  for (const key of keys.keys) {
    const agg = await kvGet(env, key.name);
    if (!agg) continue;

    // Filter by labels
    const labelsMatch = Object.entries(labels).every(([k, v]) => agg.labels[k] === v);
    if (!labelsMatch) continue;

    aggregations.push(agg);
  }

  return aggregations;
}

/**
 * Get metric time series
 */
export async function getMetricTimeSeries(env, { name, labels = {}, startTime, endTime, granularity = 60000 } = {}) {
  const prefix = `metric:`;
  const keys = await kvListRaw(env, { prefix, limit: 10000 });
  const points = [];

  for (const key of keys.keys) {
    const metric = await kvGet(env, key.name);
    if (!metric) continue;
    if (metric.name !== name) continue;
    if (startTime && metric.timestamp < startTime) continue;
    if (endTime && metric.timestamp > endTime) continue;

    // Check labels match
    const labelsMatch = Object.entries(labels).every(([k, v]) => metric.labels[k] === v);
    if (!labelsMatch) continue;

    points.push({ timestamp: metric.timestamp, value: metric.value });
  }

  // Aggregate by granularity
  const buckets = new Map();
  for (const point of points) {
    const bucketKey = Math.floor(point.timestamp / granularity) * granularity;
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, { timestamp: bucketKey, values: [] });
    }
    buckets.get(bucketKey).values.push(point.value);
  }

  const timeSeries = Array.from(buckets.values()).map(bucket => ({
    timestamp: bucket.timestamp,
    count: bucket.values.length,
    sum: bucket.values.reduce((a, b) => a + b, 0),
    avg: bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length,
    min: Math.min(...bucket.values),
    max: Math.max(...bucket.values)
  }));

  return timeSeries.sort((a, b) => a.timestamp - b.timestamp);
}

// â”€â”€ Structured Logging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

/**
 * Write structured log
 */
export async function writeLog(env, { level = "info", message, attributes = {}, spanId = null, traceId = null, userId = null }) {
  const log = {
    id: newId("log"),
    timestamp: Date.now(),
    level: level.toUpperCase(),
    message,
    attributes,
    spanId,
    traceId,
    userId
  };

  await kvPut(env, `log:${log.id}`, log, { expirationTtl: 86400 * 7 }); // Keep for 7 days

  // Add to span if provided
  if (spanId) {
    await addSpanEvent(env, spanId, {
      name: "log",
      attributes: { level: log.level, message }
    });
  }

  return log;
}

/**
 * Query logs
 */
export async function queryLogs(env, { level = null, startTime = null, endTime = null, traceId = null, userId = null, limit = 100 } = {}) {
  const keys = await kvListRaw(env, { prefix: "log:", limit: 10000 });
  const logs = [];

  for (const key of keys.keys) {
    const log = await kvGet(env, key.name);
    if (!log) continue;

    if (level && LOG_LEVELS[log.level] < LOG_LEVELS[level.toUpperCase()]) continue;
    if (startTime && log.timestamp < startTime) continue;
    if (endTime && log.timestamp > endTime) continue;
    if (traceId && log.traceId !== traceId) continue;
    if (userId && log.userId !== userId) continue;

    logs.push(log);
  }

  return logs
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

// â”€â”€ Performance Monitoring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Record performance metric
 */
export async function recordPerformance(env, { operation, duration, success = true, attributes = {} }) {
  await recordMetric(env, {
    name: `performance.${operation}.duration`,
    value: duration,
    type: "histogram",
    labels: { operation, success: String(success), ...attributes }
  });

  await recordMetric(env, {
    name: `performance.${operation}.count`,
    value: 1,
    type: "counter",
    labels: { success: String(success), ...attributes }
  });
}

/**
 * Get performance summary
 */
export async function getPerformanceSummary(env, { operations = [], startTime = null, endTime = null } = {}) {
  const summary = {};

  for (const operation of operations) {
    const durationMetrics = await getMetricAggregations(env, {
      name: `performance.${operation}.duration`
    });

    const countMetrics = await getMetricAggregations(env, {
      name: `performance.${operation}.count`
    });

    const duration = durationMetrics[0] || {};
    const count = countMetrics.reduce((sum, m) => sum + m.sum, 0);
    const successCount = countMetrics
      .filter(m => m.labels.success === "true")
      .reduce((sum, m) => sum + m.sum, 0);

    summary[operation] = {
      count,
      successCount,
      failureCount: count - successCount,
      successRate: count > 0 ? (successCount / count) * 100 : 0,
      avgDuration: duration.count > 0 ? duration.sum / duration.count : 0,
      minDuration: duration.min !== Infinity ? duration.min : null,
      maxDuration: duration.max !== -Infinity ? duration.max : null
    };
  }

  return summary;
}

// â”€â”€ Health Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get observability dashboard
 */
export async function getObservabilityDashboard(env, { hours = 24 } = {}) {
  const startTime = Date.now() - (hours * 3600000);

  const [traces, logs, metrics] = await Promise.all([
    listTraces(env, { limit: 100 }),
    queryLogs(env, { startTime, limit: 1000 }),
    getMetricAggregations(env)
  ]);

  const recentTraces = traces.filter(t => t.startTime >= startTime);
  const recentLogs = logs.filter(l => l.timestamp >= startTime);

  const errorTraces = recentTraces.filter(t => t.status === "error");
  const errorLogs = recentLogs.filter(l => LOG_LEVELS[l.level] >= LOG_LEVELS.ERROR);

  return {
    period: { hours, startTime, endTime: Date.now() },
    traces: {
      total: recentTraces.length,
      active: recentTraces.filter(t => t.status === "active").length,
      errors: errorTraces.length,
      avgDuration: recentTraces.length > 0 
        ? recentTraces.reduce((sum, t) => sum + (t.duration || 0), 0) / recentTraces.length 
        : 0
    },
    logs: {
      total: recentLogs.length,
      debug: recentLogs.filter(l => l.level === "DEBUG").length,
      info: recentLogs.filter(l => l.level === "INFO").length,
      warn: recentLogs.filter(l => l.level === "WARN").length,
      error: recentLogs.filter(l => l.level === "ERROR").length,
      fatal: recentLogs.filter(l => l.level === "FATAL").length
    },
    metrics: {
      total: metrics.length,
      counters: metrics.filter(m => m.type === "counter").length,
      gauges: metrics.filter(m => m.type === "gauge").length,
      histograms: metrics.filter(m => m.type === "histogram").length
    },
    health: {
      status: errorTraces.length > 10 || errorLogs.length > 50 ? "degraded" : "healthy",
      errorRate: recentTraces.length > 0 ? (errorTraces.length / recentTraces.length) * 100 : 0
    }
  };
}

// â”€â”€ Trace Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Wrap function with automatic tracing
 */
export function traced(name, fn) {
  return async function(env, ...args) {
    const span = await startSpan(env, { name });
    try {
      const result = await fn(env, ...args);
      await endSpan(env, span.id, { status: "ok" });
      return result;
    } catch (error) {
      await endSpan(env, span.id, { status: "error", error });
      throw error;
    }
  };
}

export { METRIC_TYPES, LOG_LEVELS };
