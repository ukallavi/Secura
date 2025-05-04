FROM bitnami/node:18-debian-11 AS base

# Set working directory
WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json ./
RUN npm install

# Rebuild the source code only when needed
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Disable telemetry during the build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM bitnami/node:18-debian-11-prod AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Bitnami images already have non-root user setup
# The default user is 'node' with uid 1001

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown node:root .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=node:root /app/.next/standalone ./
COPY --from=builder --chown=node:root /app/.next/static ./.next/static

USER 1001

EXPOSE 3000

ENV PORT=3000

# Start the application
CMD ["node", "server.js"]
