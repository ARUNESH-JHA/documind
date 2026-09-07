const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  sources: [
    {
      chunkIndex: Number,
      text: String,
      score: Number, // cosine similarity score
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const chatSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    document: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
    },
    title: {
      type: String,
      default: 'New Chat',
      maxlength: 100,
    },
    messages: [messageSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatSession', chatSessionSchema);
