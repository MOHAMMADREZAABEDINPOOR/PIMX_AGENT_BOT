// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ“¡ Server-Sent Events (SSE) Streaming
// Real-time streaming responses for LLM completions
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, kvListRaw } from "../core/kv.js";
import { route } from "./router.js";

// â”€â”€ SSE Stream Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create SSE stream for completion
 */
export async function createStreamingResponse(env, { messages, modelId, userId, options = {} }) {
  const streamId = newId("stream");
  
  // Store stream metadata
  const stream = {
    id: streamId,
    userId,
    modelId,
    status: "active",
    createdAt: nowIso(),
    chunks: [],
    totalTokens: 0
  };

  await kvPut(env, `stream:${streamId}`, stream, { expirationTtl: 3600 });

  return streamId;
}

/**
 * Generate SSE-formatted message
 */
export function formatSSE(event, data) {
  let message = "";
  if (event) message += `event: ${event}\n`;
  message += `data: ${JSON.stringify(data)}\n\n`;
  return message;
}

/**
 * Create ReadableStream for SSE
 */
export function createSSEStream(generator) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          const sseMessage = formatSSE(chunk.event || "message", chunk.data);
          controller.enqueue(encoder.encode(sseMessage));
        }
        
        // Send done event
        controller.enqueue(encoder.encode(formatSSE("done", { status: "completed" })));
        controller.close();
      } catch (error) {
        controller.enqueue(encoder.encode(formatSSE("error", { error: error.message })));
        controller.close();
      }
    }
  });
}

/**
 * Stream completion response
 */
export async function streamCompletion(env, { messages, modelId, userId, options = {} }) {
  const streamId = await createStreamingResponse(env, { messages, modelId, userId, options });
  const encoder = new TextEncoder();
  const abort = new AbortController();
  let cancelled = false;
  return new ReadableStream({
    async start(controller) {
      const emit = (event, data) => {
        if (!cancelled) controller.enqueue(encoder.encode(formatSSE(event, data)));
      };
      let previous = "", firstTokenMs = null;
      const started = Date.now();
      emit("start", { streamId, model: modelId, conversationId: options.conversationId || null });
      try {
        const result = await route(env, messages, {
          ...options, modelId, userId, signal: abort.signal,
          onChunk(full) {
            if (cancelled) return;
            if (firstTokenMs === null) firstTokenMs = Date.now() - started;
            // A fallback model may restart after a partially streamed response.
            if (!full.startsWith(previous)) {
              emit("reset", { streamId });
              previous = "";
            }
            const chunk = full.slice(previous.length);
            previous = full;
            if (chunk) emit("chunk", { streamId, chunk, done: false });
          }
        });
        if (cancelled) return;
        if (result.text !== previous) emit("chunk", { streamId, chunk: result.text.slice(previous.length), done: false });
        if (typeof options.onComplete === "function") await options.onComplete(result);
        await kvPut(env, `stream:${streamId}`, { id: streamId, userId, modelId: result.modelId, status: "completed", createdAt: new Date(started).toISOString(), completedAt: nowIso(), firstTokenMs, totalTokens: (result.promptTokens || 0) + (result.completionTokens || 0), chunks: [] }, { expirationTtl: 3600 });
        emit("metadata", {
          streamId, model: result.model, modelId: result.modelId, provider: result.providerName,
          displayName: result.displayName, conversationId: options.conversationId || null,
          latency: result.latency, firstTokenMs, cost: result.cost, text: result.text,
          tokens: { prompt: result.promptTokens, completion: result.completionTokens, total: (result.promptTokens || 0) + (result.completionTokens || 0) }
        });
        emit("done", { status: "completed" });
      } catch (error) {
        await kvPut(env, `stream:${streamId}`, { id: streamId, userId, modelId, status: cancelled ? "cancelled" : "failed", createdAt: new Date(started).toISOString(), chunks: [], totalTokens: 0 }, { expirationTtl: 3600 });
        emit("error", { streamId, error: error.message });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() { cancelled = true; abort.abort(); }
  });
}

/**
 * Create SSE response headers
 */
export function getSSEHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no" // Disable nginx buffering
  };
}

/**
 * Create SSE Response
 */
export function createSSEResponse(stream) {
  return new Response(stream, { headers: getSSEHeaders() });
}

// â”€â”€ Stream Session Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get active streams for user
 */
export async function getActiveStreams(env, userId) {
  const keys = await kvListRaw(env, { prefix: "stream:" });
  const streams = [];

  for (const key of keys.keys) {
    const stream = await kvGet(env, key.name);
    if (stream && stream.userId === userId && stream.status === "active") {
      streams.push(stream);
    }
  }

  return streams;
}

/**
 * Cancel stream
 */
export async function cancelStream(env, streamId) {
  const stream = await kvGet(env, `stream:${streamId}`);
  if (!stream) return false;

  stream.status = "cancelled";
  stream.cancelledAt = nowIso();
  await kvPut(env, `stream:${streamId}`, stream, { expirationTtl: 3600 });

  return true;
}

/**
 * Get stream status
 */
export async function getStreamStatus(env, streamId) {
  const stream = await kvGet(env, `stream:${streamId}`);
  if (!stream) return null;

  return {
    id: stream.id,
    status: stream.status,
    chunks: stream.chunks.length,
    totalTokens: stream.totalTokens,
    createdAt: stream.createdAt
  };
}

// â”€â”€ Chunked Responses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Split text into chunks for streaming
 */
export function chunkText(text, { chunkSize = 20, overlap = 0 } = {}) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}

/**
 * Stream with word boundaries
 */
export function chunkByWords(text, { wordsPerChunk = 5 } = {}) {
  const words = text.split(/\s+/);
  const chunks = [];

  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const chunk = words.slice(i, i + wordsPerChunk).join(" ");
    chunks.push(chunk + (i + wordsPerChunk < words.length ? " " : ""));
  }

  return chunks;
}

/**
 * Stream by sentences
 */
export function chunkBySentences(text) {
  return text.match(/[^.!?]+[.!?]+/g) || [text];
}

// â”€â”€ Heartbeat & Connection Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create heartbeat stream
 */
export function createHeartbeatStream(intervalMs = 30000) {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(formatSSE("heartbeat", { timestamp: Date.now() })));
      }, intervalMs);

      // Store interval for cleanup
      controller._interval = interval;
    },
    cancel(controller) {
      if (controller._interval) {
        clearInterval(controller._interval);
      }
    }
  });
}

/**
 * Merge multiple streams
 */
export function mergeStreams(...streams) {
  return new ReadableStream({
    async start(controller) {
      for (const stream of streams) {
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } finally {
          reader.releaseLock();
        }
      }
      controller.close();
    }
  });
}

// â”€â”€ Streaming Statistics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Get streaming statistics
 */
export async function getStreamingStats(env, { hours = 24 } = {}) {
  const cutoff = Date.now() - (hours * 3600000);
  const keys = await kvListRaw(env, { prefix: "stream:" });
  
  let total = 0;
  let active = 0;
  let completed = 0;
  let cancelled = 0;
  let totalTokens = 0;
  let totalLatency = 0;

  for (const key of keys.keys) {
    const stream = await kvGet(env, key.name);
    if (!stream) continue;
    if (new Date(stream.createdAt).getTime() < cutoff) continue;

    total++;
    if (stream.status === "active") active++;
    if (stream.status === "completed") completed++;
    if (stream.status === "cancelled") cancelled++;
    
    totalTokens += stream.totalTokens || 0;
    
    if (stream.completedAt && stream.createdAt) {
      const latency = new Date(stream.completedAt).getTime() - new Date(stream.createdAt).getTime();
      totalLatency += latency;
    }
  }

  return {
    period: { hours, from: new Date(cutoff).toISOString() },
    total,
    active,
    completed,
    cancelled,
    completionRate: total > 0 ? (completed / total) * 100 : 0,
    avgTokens: completed > 0 ? totalTokens / completed : 0,
    avgLatency: completed > 0 ? totalLatency / completed : 0
  };
}

// â”€â”€ TypeScript-style Types (for documentation) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * SSE Event Types
 * @typedef {'start'|'chunk'|'metadata'|'done'|'error'|'heartbeat'} SSEEventType
 */

/**
 * Stream Options
 * @typedef {Object} StreamOptions
 * @property {number} [chunkSize=20] - Characters per chunk
 * @property {number} [wordsPerChunk=5] - Words per chunk
 * @property {string} [chunkStrategy='words'] - 'chars'|'words'|'sentences'
 * @property {boolean} [includeMetadata=true] - Include metadata events
 * @property {number} [heartbeatInterval=30000] - Heartbeat interval in ms
 */
