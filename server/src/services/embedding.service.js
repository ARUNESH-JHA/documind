const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Document = require('../models/Document.model');
const chromaService = require('./chroma.service');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Text Chunking ────────────────────────────────
// Split text into overlapping chunks of ~512 tokens (approx 4 chars/token)
const chunkText = (text, chunkSize = 2000, overlap = 200) => {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push({
      text: text.slice(start, end),
      startChar: start,
      endChar: end,
    });
    start += chunkSize - overlap;
  }

  return chunks;
};

// ─── Extract Text from File ───────────────────────
const extractText = async (filePath, fileType) => {
  if (fileType === 'pdf') {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return { text: data.text, pageCount: data.numpages };
  }

  if (fileType === 'txt') {
    const text = fs.readFileSync(filePath, 'utf-8');
    return { text, pageCount: 1 };
  }

  throw new Error(`Unsupported file type: ${fileType}`);
};

// ─── Generate Embeddings via Gemini ──────────────
const embedTexts = async (texts) => {
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
  const embeddings = [];

  // Batch in groups of 10 (API limit)
  for (let i = 0; i < texts.length; i += 10) {
    const batch = texts.slice(i, i + 10);
    const results = await Promise.all(
      batch.map((text) =>
        model.embedContent(text).then((r) => r.embedding.values)
      )
    );
    embeddings.push(...results);
    logger.info(`Embedded batch ${i / 10 + 1}/${Math.ceil(texts.length / 10)}`);
  }

  return embeddings;
};

// ─── Main Processing Pipeline ─────────────────────
exports.processDocument = async (doc) => {
  try {
    // 1. PARSING
    await Document.findByIdAndUpdate(doc._id, { status: 'PARSING' });
    logger.info(`[${doc._id}] Parsing ${doc.originalName}...`);

    const { text, pageCount } = await extractText(doc.filePath, doc.fileType);

    // 2. CHUNKING
    await Document.findByIdAndUpdate(doc._id, { status: 'CHUNKING', pageCount });
    logger.info(`[${doc._id}] Chunking text (${text.length} chars)...`);

    const rawChunks = chunkText(text);
    logger.info(`[${doc._id}] Created ${rawChunks.length} chunks`);

    // 3. EMBEDDING
    await Document.findByIdAndUpdate(doc._id, { status: 'EMBEDDING' });

    const embeddings = await embedTexts(rawChunks.map((c) => c.text));

    const chunks = rawChunks.map((chunk, i) => ({
      id: `${doc.chromaCollectionId}_chunk_${i}`,
      text: chunk.text,
      embedding: embeddings[i],
      metadata: {
        chunkIndex: i,
        startChar: chunk.startChar,
        endChar: chunk.endChar,
        documentId: doc._id.toString(),
      },
    }));

    // 4. Store in ChromaDB
    await chromaService.addEmbeddings(doc.chromaCollectionId, chunks);

    // 5. READY
    await Document.findByIdAndUpdate(doc._id, {
      status: 'READY',
      chunkCount: chunks.length,
      pageCount,
    });

    logger.info(`[${doc._id}] ✅ Document ready with ${chunks.length} chunks`);
  } catch (error) {
    logger.error(`[${doc._id}] ❌ Processing failed: ${error.message}`);
    await Document.findByIdAndUpdate(doc._id, {
      status: 'FAILED',
      errorMessage: error.message,
    });
    throw error;
  }
};

// ─── Export for use in RAG ────────────────────────
exports.embedTexts = embedTexts;
exports.chunkText = chunkText;
