const Document = require('../models/Document.model');
const ChatSession = require('../models/ChatSession.model');
const ragService = require('../services/rag.service');

// POST /api/chat/sessions — create a new session
exports.createSession = async (req, res) => {
  const { documentId } = req.body;

  const doc = await Document.findOne({ _id: documentId, user: req.user.id });
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  if (doc.status !== 'READY') {
    return res.status(400).json({ message: `Document is still ${doc.status}. Please wait.` });
  }

  const session = await ChatSession.create({
    user: req.user.id,
    document: documentId,
    title: `Chat about ${doc.originalName}`,
  });

  res.status(201).json({ session });
};

// GET /api/chat/sessions — list all sessions for user
exports.getSessions = async (req, res) => {
  const sessions = await ChatSession.find({ user: req.user.id })
    .populate('document', 'originalName status')
    .select('-messages')
    .sort({ updatedAt: -1 });

  res.json({ sessions });
};

// GET /api/chat/sessions/:id — get session with messages
exports.getSession = async (req, res) => {
  const session = await ChatSession.findOne({ _id: req.params.id, user: req.user.id })
    .populate('document', 'originalName fileType');

  if (!session) return res.status(404).json({ message: 'Session not found' });
  res.json({ session });
};

// POST /api/chat/sessions/:id/ask — SSE streaming endpoint
exports.ask = async (req, res) => {
  const { question } = req.body;
  if (!question?.trim()) {
    return res.status(400).json({ message: 'Question is required' });
  }

  const session = await ChatSession.findOne({ _id: req.params.id, user: req.user.id })
    .populate('document');

  if (!session) return res.status(404).json({ message: 'Session not found' });
  if (session.document.status !== 'READY') {
    return res.status(400).json({ message: 'Document not ready' });
  }

  // Save user message
  session.messages.push({ role: 'user', content: question });

  // ─── SSE Setup ──────────────────────────────────
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { answer, sources } = await ragService.query({
      question,
      document: session.document,
      chatHistory: session.messages.slice(-10), // last 5 turns
      onToken: (token) => send('token', { token }),
    });

    // Save assistant message
    session.messages.push({ role: 'assistant', content: answer, sources });

    // Auto-title the session on first question
    if (session.messages.length === 2) {
      session.title = question.slice(0, 80);
    }

    await session.save();

    send('done', { answer, sources, sessionId: session._id });
    res.end();
  } catch (err) {
    send('error', { message: err.message });
    res.end();
  }
};

// DELETE /api/chat/sessions/:id
exports.deleteSession = async (req, res) => {
  const session = await ChatSession.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!session) return res.status(404).json({ message: 'Session not found' });
  res.json({ message: 'Session deleted' });
};
