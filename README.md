# 🧠 DocuMind — AI-Powered Document Q&A

> Chat with your documents using AI. Upload PDFs, ask questions, get answers with source citations.

[![CI](https://github.com/YOUR_USERNAME/documind/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/documind/actions)
[![Docker](https://img.shields.io/badge/Docker-ready-blue)](./docker-compose.yml)

---

## ✨ Features

- 📄 **Upload PDFs & TXTs** — Drag-and-drop file upload
- 🤖 **RAG Pipeline** — Retrieval-Augmented Generation for accurate answers
- 💬 **Real-time Streaming** — AI responses streamed token by token
- 📍 **Source Citations** — See exactly which parts of the document were used
- 🔐 **JWT Auth** — Secure login with refresh token rotation
- 🐳 **Docker Ready** — One command to run everything
- ⚙️ **CI/CD** — Automated tests + Docker image builds on every push

---

## 🏗️ Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, React Query, CSS Modules |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| Vector DB | ChromaDB |
| AI | Google Gemini API |
| Auth | JWT + Refresh Tokens |
| DevOps | Docker, Docker Compose, GitHub Actions |

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Google Gemini API Key (free at [aistudio.google.com](https://aistudio.google.com/apikey))

### 1. Clone & Configure

```bash
git clone https://github.com/YOUR_USERNAME/documind.git
cd documind
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

### 2. Start with Docker

```bash
docker compose up --build
```

That's it! Open:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000
- **API Health**: http://localhost:5000/api/health

---

## 📐 Architecture

```
User → React Frontend → Express API → MongoDB (users, chats)
                              ↓
                    PDF Parser → Text Chunker
                              ↓
                    Gemini Embedding API
                              ↓
                         ChromaDB (vectors)
                              ↓
                    Similarity Search → RAG Prompt → Gemini Flash → SSE Stream
```

---

## 🔑 API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Get current user |

### Documents
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/documents/upload` | Upload file |
| GET | `/api/documents` | List all documents |
| GET | `/api/documents/:id/status` | Get processing status |
| DELETE | `/api/documents/:id` | Delete document |

### Chat
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat/sessions` | Create chat session |
| GET | `/api/chat/sessions` | List sessions |
| POST | `/api/chat/sessions/:id/ask` | Ask question (SSE stream) |

---

## 🧪 Running Tests

```bash
# Backend tests
cd server && npm test

# Frontend tests
cd client && npm test
```

---

## 🔄 CI/CD Pipeline

| Event | Action |
|---|---|
| Push to any branch | Run tests + lint |
| PR to main | Full test suite + Docker build check |
| Merge to main | Build images → Push to GHCR → Deploy to Render |

---

## 📁 Project Structure

```
documind/
├── client/               # React frontend
├── server/               # Express API
│   ├── src/
│   │   ├── controllers/  # Route handlers
│   │   ├── models/       # Mongoose schemas
│   │   ├── routes/       # Express routes
│   │   ├── services/     # RAG, embeddings, ChromaDB
│   │   └── middleware/   # Auth, upload, errors
│   └── tests/            # Jest + Supertest
├── .github/workflows/    # CI/CD pipelines
└── docker-compose.yml    # Multi-container setup
```

---

## 📄 License

MIT
