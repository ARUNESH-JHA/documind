const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Document = require('../models/Document.model');
const embeddingService = require('../services/embedding.service');
const logger = require('../utils/logger');

// POST /api/documents/upload
exports.upload = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const { originalname, filename, size, mimetype } = req.file;
  const ext = path.extname(originalname).slice(1).toLowerCase();

  const doc = await Document.create({
    user: req.user.id,
    filename,
    originalName: originalname,
    fileType: ext,
    fileSize: size,
    filePath: req.file.path,
    status: 'UPLOADED',
    chromaCollectionId: `doc_${uuidv4().replace(/-/g, '_')}`,
  });

  // Start async processing pipeline (non-blocking)
  embeddingService.processDocument(doc).catch((err) => {
    logger.error(`Failed to process document ${doc._id}: ${err.message}`);
  });

  res.status(201).json({
    message: 'File uploaded. Processing started.',
    document: {
      id: doc._id,
      originalName: doc.originalName,
      status: doc.status,
      fileSize: doc.fileSize,
      createdAt: doc.createdAt,
    },
  });
};

// GET /api/documents
exports.getAll = async (req, res) => {
  const documents = await Document.find({ user: req.user.id })
    .select('-filePath -chromaCollectionId')
    .sort({ createdAt: -1 });

  res.json({ documents });
};

// GET /api/documents/:id
exports.getOne = async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, user: req.user.id });
  if (!doc) return res.status(404).json({ message: 'Document not found' });

  res.json({ document: doc });
};

// DELETE /api/documents/:id
exports.remove = async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, user: req.user.id });
  if (!doc) return res.status(404).json({ message: 'Document not found' });

  // Delete file from disk
  if (fs.existsSync(doc.filePath)) {
    fs.unlinkSync(doc.filePath);
  }

  // Delete embeddings from ChromaDB
  const chromaService = require('../services/chroma.service');
  await chromaService.deleteCollection(doc.chromaCollectionId).catch(() => {});

  await doc.deleteOne();
  res.json({ message: 'Document deleted successfully' });
};

// GET /api/documents/:id/status
exports.getStatus = async (req, res) => {
  const doc = await Document.findOne(
    { _id: req.params.id, user: req.user.id },
    'status errorMessage chunkCount pageCount'
  );
  if (!doc) return res.status(404).json({ message: 'Document not found' });

  res.json({ status: doc.status, errorMessage: doc.errorMessage, chunkCount: doc.chunkCount, pageCount: doc.pageCount });
};
