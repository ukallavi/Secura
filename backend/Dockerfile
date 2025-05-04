FROM bitnami/node:18-debian-11-prod AS base

# Create app directory
WORKDIR /app

# Install dependencies with production flag for smaller image
COPY package*.json ./
RUN npm ci --only=production

# Copy application code
COPY . .

# Create directory for logs with proper permissions
RUN mkdir -p logs && chmod 755 logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Bitnami images already have a non-root user 'node' with uid 1001
# Ensure proper ownership
RUN chown -R 1001:root /app

# Switch to non-root user
USER 1001

# Expose the port
EXPOSE 5000

# Healthcheck to ensure the application is running properly
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["node", "server.js"]
