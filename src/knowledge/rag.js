// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ§  RAG Pipeline â€” Retrieval-Augmented Generation
// Document ingestion, chunking, retrieval, generation
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, kvListRaw } from "../core/kv.js";
import { audit } from "../core/audit.js";
import { createVectorIndex, indexDocuments, semanticSearch } from "./vectorize.js";
import { route } from "../gateway/router.js";

// â”€â”€ RAG Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const RAG_DEFAULTS = {
  chunkSize: 500, // characters
  chunkOverlap: 50,
  topK: 5, // number of chunks to retrieve
  embeddingModel: "text-embedding-ada-002",
  generationModel: "gpt-4",
  temperature: 0.7,
  maxTokens: 1000
};

// â”€â”€ Document Processing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Chunk text into overlapping segments
 */
export function chunkText(text, { chunkSize = 500, overlap = 50 } = {}) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    chunks.push({
      id: newId("chunk"),
      content: chunk,
      start,
      end,
      length: chunk.length
    });

    start += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Smart chunking (sentence-aware)
 */
export function smartChunk(text, { maxChunkSize = 500, minChunkSize = 100 } = {}) {
  // Split by sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let currentChunk = "";
  let chunkStart = 0;

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length >= minChunkSize) {
      // Save current chunk
      chunks.push({
        id: newId("chunk"),
        content: currentChunk.trim(),
        start: chunkStart,
        end: chunkStart + currentChunk.length,
        length: currentChunk.length
      });

      currentChunk = sentence;
      chunkStart += currentChunk.length;
    } else {
      currentChunk += sentence;
    }
  }

  // Add final chunk
  if (currentChunk.trim()) {
    chunks.push({
      id: newId("chunk"),
      content: currentChunk.trim(),
      start: chunkStart,
      end: chunkStart + currentChunk.length,
      length: currentChunk.length
    });
  }

  return chunks;
}

// â”€â”€ Knowledge Base Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create knowledge base
 */
export async function createKnowledgeBase(env, { name, description, embeddingModel, userId }) {
  // Create vector index for embeddings
  const vectorIndex = await createVectorIndex(env, {
    name: `kb_${name}`,
    dimensions: 1536, // OpenAI embeddings
    metric: "cosine",
    description: `Vector index for ${name}`,
    userId
  });

  const kb = {
    id: newId("kb"),
    name,
    description,
    vectorIndexId: vectorIndex.id,
    embeddingModel: embeddingModel || RAG_DEFAULTS.embeddingModel,
    documentCount: 0,
    chunkCount: 0,
    createdBy: userId,
    createdAt: nowIso()
  };

  await kvPut(env, `knowledge_base:${kb.id}`, kb);
  await audit(env, { userId, action: "rag.kb.create", resource: kb.id, meta: { name } });

  return kb;
}

/**
 * Get knowledge base
 */
export async function getKnowledgeBase(env, kbId) {
  return await kvGet(env, `knowledge_base:${kbId}`);
}

/**
 * List knowledge bases
 */
export async function listKnowledgeBases(env, { userId = null } = {}) {
  const keys = await kvListRaw(env, { prefix: "knowledge_base:" });
  const kbs = [];

  for (const key of keys.keys) {
    const kb = await kvGet(env, key.name);
    if (!kb) continue;
    if (userId && kb.createdBy !== userId) continue;
    kbs.push(kb);
  }

  return kbs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Delete knowledge base
 */
export async function deleteKnowledgeBase(env, kbId, userId) {
  const kb = await getKnowledgeBase(env, kbId);
  if (!kb) return false;

  // Delete documents
  const docs = await listDocuments(env, kbId);
  for (const doc of docs) {
    await deleteDocument(env, kbId, doc.id, userId);
  }

  await kvPut(env, `knowledge_base:${kbId}`, null);
  await audit(env, { userId, action: "rag.kb.delete", resource: kbId });

  return true;
}

// â”€â”€ Document Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Add document to knowledge base
 */
export async function addDocument(env, {
  kbId,
  content,
  title,
  source,
  metadata = {},
  chunkingStrategy = "smart",
  userId
}) {
  const kb = await getKnowledgeBase(env, kbId);
  if (!kb) throw new Error("Knowledge base not found");

  // Create document
  const doc = {
    id: newId("doc"),
    kbId,
    title,
    source,
    content,
    metadata,
    chunkCount: 0,
    addedBy: userId,
    addedAt: nowIso()
  };

  await kvPut(env, `kb_doc:${kbId}:${doc.id}`, doc);

  // Chunk the document
  const chunks = chunkingStrategy === "smart" 
    ? smartChunk(content)
    : chunkText(content);

  // Index chunks
  const documents = chunks.map(chunk => ({
    id: `${doc.id}_${chunk.id}`,
    content: chunk.content,
    title,
    source,
    metadata: {
      documentId: doc.id,
      chunkIndex: chunks.indexOf(chunk),
      ...metadata
    }
  }));

  await indexDocuments(env, {
    indexId: kb.vectorIndexId,
    documents,
    embeddingModelId: kb.embeddingModel,
    userId
  });

  // Update counts
  doc.chunkCount = chunks.length;
  await kvPut(env, `kb_doc:${kbId}:${doc.id}`, doc);

  kb.documentCount += 1;
  kb.chunkCount += chunks.length;
  await kvPut(env, `knowledge_base:${kbId}`, kb);

  await audit(env, { userId, action: "rag.doc.add", resource: doc.id, meta: { kbId, title, chunks: chunks.length } });

  return { document: doc, chunks: chunks.length };
}

/**
 * Get document
 */
export async function getDocument(env, kbId, docId) {
  return await kvGet(env, `kb_doc:${kbId}:${docId}`);
}

/**
 * List documents in knowledge base
 */
export async function listDocuments(env, kbId) {
  const keys = await kvListRaw(env, { prefix: `kb_doc:${kbId}:` });
  const docs = [];

  for (const key of keys.keys) {
    const doc = await kvGet(env, key.name);
    if (doc) docs.push(doc);
  }

  return docs.sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
}

/**
 * Delete document
 */
export async function deleteDocument(env, kbId, docId, userId) {
  const doc = await getDocument(env, kbId, docId);
  if (!doc) return false;

  // Note: Chunks in vector index would need to be deleted separately
  // For simplicity, we're just removing the document record

  await kvPut(env, `kb_doc:${kbId}:${docId}`, null);

  // Update counts
  const kb = await getKnowledgeBase(env, kbId);
  if (kb) {
    kb.documentCount = Math.max(0, kb.documentCount - 1);
    kb.chunkCount = Math.max(0, kb.chunkCount - doc.chunkCount);
    await kvPut(env, `knowledge_base:${kbId}`, kb);
  }

  await audit(env, { userId, action: "rag.doc.delete", resource: docId, meta: { kbId } });

  return true;
}

// â”€â”€ RAG Query Pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * RAG query (retrieve + generate)
 */
export async function ragQuery(env, {
  kbId,
  query,
  topK = 5,
  generationModel,
  systemPrompt = null,
  temperature = 0.7,
  maxTokens = 1000,
  userId
}) {
  const kb = await getKnowledgeBase(env, kbId);
  if (!kb) throw new Error("Knowledge base not found");

  // 1. Retrieve relevant chunks
  const retrieval = await semanticSearch(env, {
    indexId: kb.vectorIndexId,
    query,
    embeddingModelId: kb.embeddingModel,
    topK,
    userId
  });

  if (retrieval.length === 0) {
    return {
      answer: "I don't have enough information in the knowledge base to answer that question.",
      sources: [],
      retrieved: 0
    };
  }

  // 2. Build context from retrieved chunks
  const context = retrieval
    .map((r, i) => `[${i + 1}] ${r.metadata.content}`)
    .join("\n\n");

  // 3. Generate answer
  const messages = [
    {
      role: "system",
      content: systemPrompt || `You are a helpful assistant. Answer the question based on the following context:\n\n${context}\n\nIf the context doesn't contain relevant information, say so.`
    },
    {
      role: "user",
      content: query
    }
  ];

  const result = await route(env, messages, {
    modelId: generationModel || RAG_DEFAULTS.generationModel,
    temperature,
    maxTokens,
    userId
  });

  // 4. Return answer with sources
  const sources = retrieval.map(r => ({
    documentId: r.metadata.documentId,
    title: r.metadata.title,
    score: r.score,
    excerpt: r.metadata.content.slice(0, 200) + "..."
  }));

  return {
    answer: result.text,
    sources,
    retrieved: retrieval.length,
    model: result.model,
    latency: result.latency,
    cost: result.cost
  };
}

/**
 * Multi-hop RAG query (iterative retrieval)
 */
export async function multiHopRagQuery(env, {
  kbId,
  query,
  maxHops = 3,
  topKPerHop = 3,
  generationModel,
  userId
}) {
  const kb = await getKnowledgeBase(env, kbId);
  if (!kb) throw new Error("Knowledge base not found");

  let allRetrieved = [];
  let currentQuery = query;
  const hops = [];

  for (let hop = 0; hop < maxHops; hop++) {
    // Retrieve for current query
    const retrieval = await semanticSearch(env, {
      indexId: kb.vectorIndexId,
      query: currentQuery,
      embeddingModelId: kb.embeddingModel,
      topK: topKPerHop,
      userId
    });

    if (retrieval.length === 0) break;

    allRetrieved.push(...retrieval);
    hops.push({
      hop: hop + 1,
      query: currentQuery,
      retrieved: retrieval.length
    });

    // Generate follow-up query if not last hop
    if (hop < maxHops - 1) {
      const context = retrieval.map(r => r.metadata.content).join("\n");
      const followUpPrompt = `Based on this context:\n${context}\n\nOriginal question: ${query}\n\nWhat additional information would help answer this question? Generate a single follow-up search query.`;

      const result = await route(env, [
        { role: "user", content: followUpPrompt }
      ], {
        modelId: generationModel || RAG_DEFAULTS.generationModel,
        maxTokens: 100,
        userId
      });

      currentQuery = result.text.trim();
    }
  }

  // Generate final answer
  const context = allRetrieved
    .map((r, i) => `[${i + 1}] ${r.metadata.content}`)
    .join("\n\n");

  const messages = [
    {
      role: "system",
      content: `Answer the question based on the following context:\n\n${context}`
    },
    {
      role: "user",
      content: query
    }
  ];

  const result = await route(env, messages, {
    modelId: generationModel || RAG_DEFAULTS.generationModel,
    userId
  });

  return {
    answer: result.text,
    hops,
    totalRetrieved: allRetrieved.length,
    sources: allRetrieved.map(r => ({
      documentId: r.metadata.documentId,
      title: r.metadata.title,
      score: r.score
    }))
  };
}

/**
 * RAG with citation
 */
export async function ragQueryWithCitations(env, options) {
  const result = await ragQuery(env, options);

  // Add citation markers to answer
  const citedAnswer = result.answer.replace(
    /\[(\d+)\]/g,
    (match, num) => {
      const source = result.sources[parseInt(num) - 1];
      return source ? `[${num}: ${source.title}]` : match;
    }
  );

  return {
    ...result,
    answer: citedAnswer,
    citations: result.sources
  };
}

/**
 * RAG statistics
 */
export async function getRagStats(env, kbId) {
  const kb = await getKnowledgeBase(env, kbId);
  if (!kb) throw new Error("Knowledge base not found");

  const docs = await listDocuments(env, kbId);

  return {
    kbId,
    name: kb.name,
    documentCount: kb.documentCount,
    chunkCount: kb.chunkCount,
    avgChunksPerDoc: kb.documentCount > 0 ? kb.chunkCount / kb.documentCount : 0,
    embeddingModel: kb.embeddingModel,
    vectorIndexId: kb.vectorIndexId,
    recentDocuments: docs.slice(0, 5).map(d => ({
      id: d.id,
      title: d.title,
      addedAt: d.addedAt
    }))
  };
}
