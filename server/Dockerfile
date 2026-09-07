# ─── Stage 1: Development ────────────────────────
FROM node:20-alpine AS development

WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .

EXPOSE 5000
CMD ["npm", "run", "dev"]

# ─── Stage 2: Builder ────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install --only=production --legacy-peer-deps
COPY . .

# ─── Stage 3: Production ─────────────────────────
FROM node:20-alpine AS production

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001
USER nodeuser

EXPOSE 5000
CMD ["node", "src/index.js"]
