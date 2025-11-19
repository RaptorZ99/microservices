# Étape 1 : Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Dépendances NPM
COPY package*.json ./
RUN npm ci

# Copie du reste du code source
COPY . .

# Génération du client Prisma
RUN npx prisma generate

# Compilation du projet NestJS
RUN npm run build

# Étape 2 : Runner minimal
FROM node:20-alpine AS runner

WORKDIR /app

# Copie des artefacts essentiels
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

ENV NODE_ENV=production
ENV PORT=4000

# IMPORTANT : chemin absoluté dans l'image
ENV DATABASE_URL="file:/app/prisma/dev.db"
ENV JWT_SECRET="change-me"

RUN npx prisma migrate deploy

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
