# High-Fidelity Docker Manifestation for the Tavern
# Build Stage: Siphoning the dependencies and architecting the binary

FROM node:20-alpine AS builder

WORKDIR /app

# Siphon the blueprints
COPY package*.json ./
RUN npm install --frozen-lockfile

# Siphon the source artifacts
COPY . .

# Manifest the production binary
RUN npm run build

# Runner Stage: The high-fidelity manifestation environment
FROM node:20-alpine AS runner

WORKDIR /app

# Ensure we have the production profile manifest
ENV NODE_ENV=production

# Siphon only the essential production artifacts
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Begin the high-fidelity discourse
CMD ["npm", "start"]
