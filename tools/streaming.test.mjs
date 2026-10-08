import test from 'node:test';
import assert from 'node:assert/strict';
import { streamCompletion } from '../src/gateway/streaming.js';
import { modelEnv } from './test-fixtures.mjs';

test('first token reaches the Mini App before upstream generation finishes', async () => {
  const originalFetch = globalThis.fetch;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let upstreamFinished = false;
  let requestedStream = false;
  globalThis.fetch = async (url, options) => {
    requestedStream = JSON.parse(options.body).stream === true;
    if (!requestedStream) {
      await gate;
      upstreamFinished = true;
      return Response.json({ choices: [{ message: { content: 'سلام دنیا' } }] });
    }
    const enc = new TextEncoder();
    return new Response(new ReadableStream({ async start(controller) {
      controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"سلام"}}]}\n\n'));
      await gate;
      upstreamFinished = true;
      controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":" دنیا"}}]}\n\ndata: [DONE]\n\n'));
      controller.close();
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  };
  let reader;
  try {
    const stream = await streamCompletion(modelEnv(), { messages: [{ role: 'user', content: 'سلام' }], modelId: 'model_fixture', userId: 101 });
    reader = stream.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /event: start/);
    const token = await Promise.race([reader.read(), new Promise(resolve => setTimeout(() => resolve(null), 100))]);
    assert.ok(token, 'No token arrived while upstream generation was pending');
    assert.equal(requestedStream, true, 'Provider must be called with stream=true');
    assert.equal(upstreamFinished, false);
    assert.match(new TextDecoder().decode(token.value), /سلام/);
  } finally {
    release();
    if (reader) while (!(await reader.read()).done) {}
    globalThis.fetch = originalFetch;
  }
});
