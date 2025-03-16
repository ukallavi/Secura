FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install

# Copy application code
COPY . .

# Create directory for logs
RUN mkdir -p logs

# Set environment variables
ENV NODE_ENV=production

# Expose the port
EXPOSE 5000

# Start the application
CMD ["node", "server.js"]
