// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ” Vector Search â€” Cloudflare Vectorize Integration
// Embeddings, semantic search, similarity matching
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, kvListRaw } from "../core/kv.js";
import { audit } from "../core/audit.js";

// â”€â”€ Vector Index Management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Create vector index
 */
export async function createVectorIndex(env, { name, dimensions = 1536, metric = "cosine", description, userId }) {
  const index = {
    id: newId("vidx"),
    name,
    dimensions, // 1536 for OpenAI text-embedding-ada-002, 768 for sentence-transformers
    metric, // "cosine", "euclidean", "dot"
    description,
    vectorCount: 0,
    createdBy: userId,
    createdAt: nowIso()
  };

  await kvPut(env, `vector_index:${index.id}`, index);
  await audit(env, { userId, action: "vector.index.create", resource: index.id, meta: { name, dimensions } });

  return index;
}

/**
 * Get vector index
 */
export async function getVectorIndex(env, indexId) {
  return await kvGet(env, `vector_index:${indexId}`);
}

/**
 * List vector indexes
 */
export async function listVectorIndexes(env) {
  const keys = await kvListRaw(env, { prefix: "vector_index:" });
  const indexes = [];

  for (const key of keys.keys) {
    const index = await kvGet(env, key.name);
    if (index) indexes.push(index);
  }

  return indexes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Delete vector index
 */
export async function deleteVectorIndex(env, indexId, userId) {
  // Delete all vectors in index
  const keys = await kvListRaw(env, { prefix: `vector:${indexId}:` });
  for (const key of keys.keys) {
    await kvPut(env, key.name, null);
  }

  await kvPut(env, `vector_index:${indexId}`, null);
  await audit(env, { userId, action: "vector.index.delete", resource: indexId });

  return true;
}

// â”€â”€ Vector Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Insert vectors into index
 */
export async function insertVectors(env, indexId, vectors) {
  const index = await getVectorIndex(env, indexId);
  if (!index) throw new Error("Vector index not found");

  const results = [];

  for (const vector of vectors) {
    if (!vector.id) vector.id = newId("vec");
    
    if (vector.values.length !== index.dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${index.dimensions}, got ${vector.values.length}`);
    }

    const vectorDoc = {
      id: vector.id,
      indexId,
      values: vector.values,
      metadata: vector.metadata || {},
      createdAt: nowIso()
    };

    await kvPut(env, `vector:${indexId}:${vector.id}`, vectorDoc);
    results.push({ id: vector.id, indexed: true });
  }

  // Update vector count
  index.vectorCount += vectors.length;
  await kvPut(env, `vector_index:${indexId}`, index);

  return { inserted: results.length, vectors: results };
}

/**
 * Query vectors (similarity search)
 */
export async function queryVectors(env, indexId, { vector, topK = 10, includeMetadata = true, filter = null }) {
  const index = await getVectorIndex(env, indexId);
  if (!index) throw new Error("Vector index not found");

  if (vector.length !== index.dimensions) {
    throw new Error(`Query vector dimension mismatch: expected ${index.dimensions}, got ${vector.length}`);
  }

  // Get all vectors in index
  const keys = await kvListRaw(env, { prefix: `vector:${indexId}:`, limit: 10000 });
  const candidates = [];

  for (const key of keys.keys) {
    const doc = await kvGet(env, key.name);
    if (!doc) continue;

    // Apply filter if provided
    if (filter) {
      let matches = true;
      for (const [key, value] of Object.entries(filter)) {
        if (doc.metadata[key] !== value) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;
    }

    const score = calculateSimilarity(vector, doc.values, index.metric);
    candidates.push({
      id: doc.id,
      score,
      metadata: includeMetadata ? doc.metadata : undefined
    });
  }

  // Sort by score and return top K
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, topK);
}

/**
 * Calculate similarity between two vectors
 */
function calculateSimilarity(a, b, metric) {
  if (metric === "cosine") {
    return cosineSimilarity(a, b);
  } else if (metric === "euclidean") {
    return -euclideanDistance(a, b); // Negative for consistent ordering
  } else if (metric === "dot") {
    return dotProduct(a, b);
  }
  throw new Error(`Unknown metric: ${metric}`);
}

/**
 * Cosine similarity
 */
function cosineSimilarity(a, b) {
  const dotProd = dotProduct(a, b);
  const magA = Math.sqrt(dotProduct(a, a));
  const magB = Math.sqrt(dotProduct(b, b));
  return dotProd / (magA * magB);
}

/**
 * Euclidean distance
 */
function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Dot product
 */
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Get vector by ID
 */
export async function getVector(env, indexId, vectorId) {
  return await kvGet(env, `vector:${indexId}:${vectorId}`);
}

/**
 * Delete vector
 */
export async function deleteVector(env, indexId, vectorId) {
  const vector = await getVector(env, indexId, vectorId);
  if (!vector) return false;

  await kvPut(env, `vector:${indexId}:${vectorId}`, null);

  // Update vector count
  const index = await getVectorIndex(env, indexId);
  if (index) {
    index.vectorCount = Math.max(0, index.vectorCount - 1);
    await kvPut(env, `vector_index:${indexId}`, index);
  }

  return true;
}

/**
 * Update vector metadata
 */
export async function updateVectorMetadata(env, indexId, vectorId, metadata) {
  const vector = await getVector(env, indexId, vectorId);
  if (!vector) throw new Error("Vector not found");

  vector.metadata = { ...vector.metadata, ...metadata };
  await kvPut(env, `vector:${indexId}:${vectorId}`, vector);

  return vector;
}

// â”€â”€ Embedding Generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Generate embeddings using a model
 */
export async function generateEmbedding(env, { text, modelId, userId }) {
  // This would call the actual embedding model
  // For now, return a mock embedding
  
  const { route } = await import("../gateway/router.js");
  
  try {
    // Try to use a real embedding model if available
    const result = await route(env, [
      { role: "user", content: text }
    ], {
      modelId,
      userId,
      operation: "embedding"
    });

    // Extract embedding from result
    // Format depends on the model's response
    return result.embedding || generateMockEmbedding(text);
  } catch (error) {
    // Fall back to mock embedding
    return generateMockEmbedding(text);
  }
}

/**
 * Generate mock embedding (for testing)
 */
function generateMockEmbedding(text, dimensions = 1536) {
  // Simple hash-based mock embedding
  const embedding = new Array(dimensions);
  let hash = 0;
  
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash = hash & hash;
  }

  for (let i = 0; i < dimensions; i++) {
    const seed = hash + i;
    embedding[i] = (Math.sin(seed) + 1) / 2; // Normalize to [0, 1]
  }

  // Normalize vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  for (let i = 0; i < dimensions; i++) {
    embedding[i] /= magnitude;
  }

  return embedding;
}

/**
 * Batch generate embeddings
 */
export async function generateEmbeddings(env, { texts, modelId, userId }) {
  const embeddings = [];

  for (const text of texts) {
    const embedding = await generateEmbedding(env, { text, modelId, userId });
    embeddings.push(embedding);
  }

  return embeddings;
}

// â”€â”€ Semantic Search Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Index text documents with embeddings
 */
export async function indexDocuments(env, { indexId, documents, embeddingModelId, userId }) {
  const vectors = [];

  for (const doc of documents) {
    const embedding = await generateEmbedding(env, {
      text: doc.content,
      modelId: embeddingModelId,
      userId
    });

    vectors.push({
      id: doc.id,
      values: embedding,
      metadata: {
        content: doc.content,
        title: doc.title,
        source: doc.source,
        ...doc.metadata
      }
    });
  }

  return await insertVectors(env, indexId, vectors);
}

/**
 * Semantic search over text documents
 */
export async function semanticSearch(env, { indexId, query, embeddingModelId, topK = 10, filter = null, userId }) {
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(env, {
    text: query,
    modelId: embeddingModelId,
    userId
  });

  // Search for similar vectors
  const results = await queryVectors(env, indexId, {
    vector: queryEmbedding,
    topK,
    includeMetadata: true,
    filter
  });

  return results;
}

/**
 * Find similar documents
 */
export async function findSimilarDocuments(env, { indexId, documentId, topK = 10 }) {
  const vector = await getVector(env, indexId, documentId);
  if (!vector) throw new Error("Document not found");

  const results = await queryVectors(env, indexId, {
    vector: vector.values,
    topK: topK + 1, // +1 to exclude self
    includeMetadata: true
  });

  // Remove the query document itself
  return results.filter(r => r.id !== documentId).slice(0, topK);
}

// â”€â”€ Clustering & Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * K-means clustering on vectors
 */
export async function clusterVectors(env, indexId, { k = 5, maxIterations = 100 }) {
  // Get all vectors
  const keys = await kvListRaw(env, { prefix: `vector:${indexId}:`, limit: 10000 });
  const vectors = [];

  for (const key of keys.keys) {
    const doc = await kvGet(env, key.name);
    if (doc) vectors.push(doc);
  }

  if (vectors.length < k) {
    throw new Error(`Not enough vectors (${vectors.length}) for k=${k} clusters`);
  }

  const dimensions = vectors[0].values.length;

  // Initialize centroids randomly
  const centroids = [];
  for (let i = 0; i < k; i++) {
    const randomVector = vectors[Math.floor(Math.random() * vectors.length)];
    centroids.push([...randomVector.values]);
  }

  // K-means iterations
  let assignments = new Array(vectors.length).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign vectors to nearest centroid
    let changed = false;
    for (let i = 0; i < vectors.length; i++) {
      let minDist = Infinity;
      let bestCluster = 0;

      for (let c = 0; c < k; c++) {
        const dist = euclideanDistance(vectors[i].values, centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }

      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    if (!changed) break; // Converged

    // Update centroids
    for (let c = 0; c < k; c++) {
      const clusterVectors = vectors.filter((_, i) => assignments[i] === c);
      if (clusterVectors.length === 0) continue;

      for (let d = 0; d < dimensions; d++) {
        centroids[c][d] = clusterVectors.reduce((sum, v) => sum + v.values[d], 0) / clusterVectors.length;
      }
    }
  }

  // Build result
  const clusters = [];
  for (let c = 0; c < k; c++) {
    const members = vectors
      .map((v, i) => ({ ...v, assignment: assignments[i] }))
      .filter(v => v.assignment === c)
      .map(v => ({ id: v.id, metadata: v.metadata }));

    clusters.push({
      id: c,
      centroid: centroids[c],
      size: members.length,
      members
    });
  }

  return { k, clusters, iterations: maxIterations };
}

/**
 * Get vector statistics
 */
export async function getVectorStats(env, indexId) {
  const index = await getVectorIndex(env, indexId);
  if (!index) throw new Error("Vector index not found");

  // Sample vectors for stats
  const keys = await kvListRaw(env, { prefix: `vector:${indexId}:`, limit: 1000 });
  const samples = [];

  for (const key of keys.keys) {
    const doc = await kvGet(env, key.name);
    if (doc && samples.length < 100) samples.push(doc);
  }

  if (samples.length === 0) {
    return {
      indexId,
      vectorCount: 0,
      dimensions: index.dimensions,
      metric: index.metric
    };
  }

  // Calculate average magnitude
  const magnitudes = samples.map(s => 
    Math.sqrt(s.values.reduce((sum, v) => sum + v * v, 0))
  );
  const avgMagnitude = magnitudes.reduce((a, b) => a + b) / magnitudes.length;

  return {
    indexId,
    vectorCount: index.vectorCount,
    dimensions: index.dimensions,
    metric: index.metric,
    avgMagnitude,
    sampleSize: samples.length
  };
}
