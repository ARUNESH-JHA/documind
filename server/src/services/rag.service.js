const { GoogleGenerativeAI } = require('@google/generative-ai');
const chromaService = require('./chroma.service');
const { embedTexts } = require('./embedding.service');
const logger = require('../utils/logger');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ─── Build RAG Prompt ─────────────────────────────
const buildPrompt = (question, sources, chatHistory = []) => {
  const context = sources
    .map((s, i) => `[Source ${i + 1}]:\n${s.text}`)
    .join('\n\n---\n\n');

  const history = chatHistory
    .slice(-6) // last 3 turns
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  return `You are DocuMind, an intelligent document assistant. Answer questions based ONLY on the provided document context. If the answer is not in the context, say "I couldn't find this information in the document."

## Document Context:
${context}

## Conversation History:
${history}

## Current Question:
${question}

## Instructions:
- Be concise and accurate
- Reference specific parts of the document when possible
- Use markdown formatting for clarity
- If quoting directly, use quotation marks

## Answer:`;
};

// ─── Core RAG Query ───────────────────────────────
exports.query = async ({ question, document, chatHistory = [], onToken }) => {
  logger.info(`RAG query for doc ${document._id}: "${question.slice(0, 60)}..."`);

  // 1. Embed the question
  const [questionEmbedding] = await embedTexts([question]);

  // 2. Retrieve top-K similar chunks from ChromaDB
  const sources = await chromaService.querySimilar(
    document.chromaCollectionId,
    questionEmbedding,
    5
  );

  logger.info(`Retrieved ${sources.length} relevant chunks (top score: ${sources[0]?.score?.toFixed(3)})`);

  // 3. Build prompt
  const prompt = buildPrompt(question, sources, chatHistory);

  // 4. Stream response from Gemini
  const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
  const stream = await model.generateContentStream(prompt);

  let fullAnswer = '';
  for await (const chunk of stream.stream) {
    const token = chunk.text();
    fullAnswer += token;
    if (onToken) onToken(token);
  }

  return {
    answer: fullAnswer,
    sources: sources.map((s, i) => ({
      chunkIndex: s.metadata?.chunkIndex ?? i,
      text: s.text.slice(0, 300), // truncate for storage
      score: Math.round(s.score * 100) / 100,
    })),
  };
};
