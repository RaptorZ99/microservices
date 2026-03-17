# Stage 1: build
FROM node:20-alpine AS builder

WORKDIR /app

# Native deps for better-sqlite3
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:/app/data/dev.db"
ENV JWT_SECRET="change-me"
RUN npx prisma generate
RUN npm run build

# Stage 2: runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Native runtime dep for better-sqlite3
RUN apk add --no-cache libstdc++

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

RUN mkdir -p /app/data

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
