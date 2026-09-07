const { ChromaClient } = require('chromadb');
const logger = require('../utils/logger');

let client = null;

const getClient = () => {
  if (!client) {
    client = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' });
  }
  return client;
};

// Get or create a collection for a document
exports.getOrCreateCollection = async (collectionId) => {
  const chroma = getClient();
  const collection = await chroma.getOrCreateCollection({
    name: collectionId,
    metadata: { 'hnsw:space': 'cosine' },
  });
  return collection;
};

// Add embeddings to a collection
exports.addEmbeddings = async (collectionId, chunks) => {
  const collection = await exports.getOrCreateCollection(collectionId);

  await collection.add({
    ids: chunks.map((c) => c.id),
    embeddings: chunks.map((c) => c.embedding),
    documents: chunks.map((c) => c.text),
    metadatas: chunks.map((c) => c.metadata),
  });

  logger.info(`Added ${chunks.length} chunks to ChromaDB collection: ${collectionId}`);
};

// Query similar chunks
exports.querySimilar = async (collectionId, queryEmbedding, topK = 5) => {
  const collection = await exports.getOrCreateCollection(collectionId);

  const results = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    include: ['documents', 'metadatas', 'distances'],
  });

  return results.documents[0].map((text, i) => ({
    text,
    metadata: results.metadatas[0][i],
    score: 1 - results.distances[0][i], // convert distance to similarity
  }));
};

// Delete a collection
exports.deleteCollection = async (collectionId) => {
  const chroma = getClient();
  try {
    await chroma.deleteCollection({ name: collectionId });
    logger.info(`Deleted ChromaDB collection: ${collectionId}`);
  } catch (err) {
    logger.warn(`Could not delete collection ${collectionId}: ${err.message}`);
  }
};
