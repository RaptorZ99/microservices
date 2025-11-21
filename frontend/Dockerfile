# Étape 1 : Build
FROM node:20-alpine AS builder

WORKDIR /app

# Installation des dépendances
COPY package*.json ./
RUN npm ci

# Copie du code source et build Next.js
COPY . .
RUN npm run build

# Étape 2 : Runtime minimal
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copie de la build Next.js
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY package*.json ./

# Installation uniquement des dépendances nécessaires au runtime
RUN npm ci --omit=dev

EXPOSE 3000

CMD ["npm", "start"]
