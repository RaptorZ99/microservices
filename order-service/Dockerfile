# Étape 1 : Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:/app/prisma/dev.db"
ENV JWT_SECRET="change-me"

# Génération du client Prisma
RUN npx prisma generate
RUN npm run build

# Étape 2 : Runner minimal
FROM node:20-alpine AS runner

WORKDIR /app

# Copie des artefacts essentiels
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
