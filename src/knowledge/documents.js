// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ“„ Document Processing â€” PDF, DOCX, HTML, Markdown
// Extract text, metadata, structure from various formats
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { kvGet, kvPut, newId, nowIso, kvListRaw } from "../core/kv.js";
import { audit } from "../core/audit.js";

// â”€â”€ Document Processing Registry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const SUPPORTED_FORMATS = {
  pdf: { mimeType: "application/pdf", extensions: [".pdf"] },
  docx: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensions: [".docx"] },
  html: { mimeType: "text/html", extensions: [".html", ".htm"] },
  markdown: { mimeType: "text/markdown", extensions: [".md", ".markdown"] },
  text: { mimeType: "text/plain", extensions: [".txt"] },
  json: { mimeType: "application/json", extensions: [".json"] },
  xml: { mimeType: "application/xml", extensions: [".xml"] }
};

// â”€â”€ Document Upload & Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Upload document
 */
export async function uploadDocument(env, {
  filename,
  content,
  mimeType,
  metadata = {},
  userId
}) {
  const format = detectFormat(filename, mimeType);
  
  const doc = {
    id: newId("upload"),
    filename,
    format,
    mimeType,
    size: content.length,
    metadata,
    uploadedBy: userId,
    uploadedAt: nowIso(),
    processed: false,
    extractedText: null,
    extractedMetadata: {}
  };

  // Store document (in production, use R2 for large files)
  await kvPut(env, `document:${doc.id}`, doc);
  await kvPut(env, `document_content:${doc.id}`, content, { expirationTtl: 86400 * 90 }); // 90 days

  await audit(env, { userId, action: "document.upload", resource: doc.id, meta: { filename, format, size: content.length } });

  return doc;
}

/**
 * Detect document format
 */
function detectFormat(filename, mimeType) {
  for (const [format, config] of Object.entries(SUPPORTED_FORMATS)) {
    if (mimeType === config.mimeType) return format;
    if (config.extensions.some(ext => filename.toLowerCase().endsWith(ext))) return format;
  }
  return "unknown";
}

/**
 * Get document
 */
export async function getDocument(env, docId) {
  return await kvGet(env, `document:${docId}`);
}

/**
 * Get document content
 */
export async function getDocumentContent(env, docId) {
  return await kvGet(env, `document_content:${docId}`);
}

/**
 * List documents
 */
export async function listDocuments(env, { format = null, userId = null, limit = 100 } = {}) {
  const keys = await kvListRaw(env, { prefix: "document:", limit: 1000 });
  const documents = [];

  for (const key of keys.keys) {
    const doc = await kvGet(env, key.name);
    if (!doc) continue;
    if (format && doc.format !== format) continue;
    if (userId && doc.uploadedBy !== userId) continue;
    documents.push(doc);
  }

  return documents
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
    .slice(0, limit);
}

/**
 * Delete document
 */
export async function deleteDocument(env, docId, userId) {
  const doc = await getDocument(env, docId);
  if (!doc) return false;

  await kvPut(env, `document:${docId}`, null);
  await kvPut(env, `document_content:${docId}`, null);

  await audit(env, { userId, action: "document.delete", resource: docId });

  return true;
}

// â”€â”€ Text Extraction â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Process document (extract text)
 */
export async function processDocument(env, docId, userId) {
  const doc = await getDocument(env, docId);
  if (!doc) throw new Error("Document not found");

  const content = await getDocumentContent(env, docId);
  if (!content) throw new Error("Document content not found");

  let extractedText = "";
  let extractedMetadata = {};

  try {
    switch (doc.format) {
      case "pdf":
        ({ text: extractedText, metadata: extractedMetadata } = await extractFromPDF(content));
        break;
      case "docx":
        ({ text: extractedText, metadata: extractedMetadata } = await extractFromDOCX(content));
        break;
      case "html":
        ({ text: extractedText, metadata: extractedMetadata } = extractFromHTML(content));
        break;
      case "markdown":
        ({ text: extractedText, metadata: extractedMetadata } = extractFromMarkdown(content));
        break;
      case "text":
        extractedText = content;
        break;
      case "json":
        ({ text: extractedText, metadata: extractedMetadata } = extractFromJSON(content));
        break;
      case "xml":
        ({ text: extractedText, metadata: extractedMetadata } = extractFromXML(content));
        break;
      default:
        throw new Error(`Unsupported format: ${doc.format}`);
    }

    // Update document
    doc.processed = true;
    doc.extractedText = extractedText;
    doc.extractedMetadata = extractedMetadata;
    doc.processedAt = nowIso();
    doc.wordCount = extractedText.split(/\s+/).length;
    doc.charCount = extractedText.length;

    await kvPut(env, `document:${docId}`, doc);

    await audit(env, { userId, action: "document.process", resource: docId, meta: { format: doc.format, wordCount: doc.wordCount } });

    return doc;
  } catch (error) {
    doc.processed = false;
    doc.processingError = error.message;
    await kvPut(env, `document:${docId}`, doc);
    throw error;
  }
}

// â”€â”€ Format-Specific Extractors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Extract text from PDF
 * Note: This is a placeholder. Production use requires pdf-parse or similar library
 */
async function extractFromPDF(content) {
  // In production, use a library like pdf-parse:
  // const pdfParse = require('pdf-parse');
  // const data = await pdfParse(content);
  // return { text: data.text, metadata: data.metadata };

  return {
    text: "[PDF extraction requires pdf-parse library]",
    metadata: { format: "pdf", note: "Library required for actual extraction" }
  };
}

/**
 * Extract text from DOCX
 * Note: This is a placeholder. Production use requires mammoth or docx library
 */
async function extractFromDOCX(content) {
  // In production, use a library like mammoth:
  // const mammoth = require('mammoth');
  // const result = await mammoth.extractRawText({ buffer: content });
  // return { text: result.value, metadata: {} };

  return {
    text: "[DOCX extraction requires mammoth library]",
    metadata: { format: "docx", note: "Library required for actual extraction" }
  };
}

/**
 * Extract text from HTML
 */
function extractFromHTML(content) {
  // Simple HTML tag removal (production should use proper HTML parser)
  const text = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove scripts
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "") // Remove styles
    .replace(/<[^>]+>/g, " ") // Remove tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  // Extract metadata from HTML
  const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : null;

  const metaDescMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const description = metaDescMatch ? metaDescMatch[1] : null;

  return {
    text,
    metadata: { format: "html", title, description }
  };
}

/**
 * Extract text from Markdown
 */
function extractFromMarkdown(content) {
  // Remove markdown syntax but keep text
  const text = content
    .replace(/^#+\s+/gm, "") // Headers
    .replace(/\*\*([^*]+)\*\*/g, "$1") // Bold
    .replace(/\*([^*]+)\*/g, "$1") // Italic
    .replace(/`([^`]+)`/g, "$1") // Inline code
    .replace(/```[\s\S]*?```/g, "") // Code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Links
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // Images
    .trim();

  // Extract title (first header)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : null;

  return {
    text,
    metadata: { format: "markdown", title }
  };
}

/**
 * Extract text from JSON
 */
function extractFromJSON(content) {
  try {
    const data = JSON.parse(content);
    const text = extractTextFromObject(data);
    return {
      text,
      metadata: { format: "json", keys: Object.keys(data).length }
    };
  } catch (error) {
    return {
      text: content,
      metadata: { format: "json", parseError: error.message }
    };
  }
}

/**
 * Recursively extract text from JSON object
 */
function extractTextFromObject(obj, depth = 0) {
  if (depth > 10) return ""; // Prevent infinite recursion

  if (typeof obj === "string") return obj + " ";
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj) + " ";
  if (obj === null || obj === undefined) return "";

  if (Array.isArray(obj)) {
    return obj.map(item => extractTextFromObject(item, depth + 1)).join("");
  }

  if (typeof obj === "object") {
    return Object.values(obj).map(value => extractTextFromObject(value, depth + 1)).join("");
  }

  return "";
}

/**
 * Extract text from XML
 */
function extractFromXML(content) {
  // Simple XML tag removal
  const text = content
    .replace(/<\?xml[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    text,
    metadata: { format: "xml" }
  };
}

// â”€â”€ Batch Processing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Batch process documents
 */
export async function batchProcessDocuments(env, { docIds, userId }) {
  const results = [];

  for (const docId of docIds) {
    try {
      const processed = await processDocument(env, docId, userId);
      results.push({ docId, success: true, wordCount: processed.wordCount });
    } catch (error) {
      results.push({ docId, success: false, error: error.message });
    }
  }

  return {
    total: docIds.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  };
}

// â”€â”€ Document Analysis â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Analyze document content
 */
export async function analyzeDocument(env, docId) {
  const doc = await getDocument(env, docId);
  if (!doc) throw new Error("Document not found");
  if (!doc.processed) throw new Error("Document not processed yet");

  const text = doc.extractedText;
  const words = text.split(/\s+/);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Word frequency
  const wordFreq = {};
  for (const word of words) {
    const lower = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (lower.length > 3) { // Skip short words
      wordFreq[lower] = (wordFreq[lower] || 0) + 1;
    }
  }

  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  return {
    docId,
    filename: doc.filename,
    format: doc.format,
    wordCount: words.length,
    sentenceCount: sentences.length,
    charCount: text.length,
    avgWordLength: words.reduce((sum, w) => sum + w.length, 0) / words.length,
    avgSentenceLength: words.length / sentences.length,
    topWords,
    readingTime: Math.ceil(words.length / 200) // 200 words per minute
  };
}

/**
 * Extract entities from document (simple keyword extraction)
 */
export async function extractEntities(env, docId) {
  const doc = await getDocument(env, docId);
  if (!doc || !doc.processed) throw new Error("Document not processed");

  const text = doc.extractedText;

  // Simple entity patterns
  const entities = {
    emails: [...new Set(text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [])],
    urls: [...new Set(text.match(/https?:\/\/[^\s]+/g) || [])],
    dates: [...new Set(text.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) || [])],
    phones: [...new Set(text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || [])],
    // Capitalized words (potential proper nouns)
    properNouns: [...new Set(text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [])].slice(0, 50)
  };

  return { docId, entities };
}

/**
 * Compare documents for similarity
 */
export async function compareDocuments(env, docId1, docId2) {
  const [doc1, doc2] = await Promise.all([
    getDocument(env, docId1),
    getDocument(env, docId2)
  ]);

  if (!doc1 || !doc2) throw new Error("Documents not found");
  if (!doc1.processed || !doc2.processed) throw new Error("Documents not processed");

  // Simple word-based similarity
  const words1 = new Set(doc1.extractedText.toLowerCase().split(/\s+/));
  const words2 = new Set(doc2.extractedText.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  const jaccardSimilarity = intersection.size / union.size;

  return {
    doc1: { id: docId1, filename: doc1.filename },
    doc2: { id: docId2, filename: doc2.filename },
    similarity: jaccardSimilarity,
    commonWords: intersection.size,
    uniqueWords: union.size
  };
}

/**
 * Get document statistics
 */
export async function getDocumentStats(env) {
  const docs = await listDocuments(env);

  const stats = {
    total: docs.length,
    processed: docs.filter(d => d.processed).length,
    unprocessed: docs.filter(d => !d.processed).length,
    byFormat: {},
    totalSize: 0,
    totalWords: 0
  };

  for (const doc of docs) {
    stats.byFormat[doc.format] = (stats.byFormat[doc.format] || 0) + 1;
    stats.totalSize += doc.size || 0;
    if (doc.wordCount) stats.totalWords += doc.wordCount;
  }

  return stats;
}
