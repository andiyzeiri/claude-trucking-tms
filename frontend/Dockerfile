FROM node:20-alpine

WORKDIR /app

# Install dependencies for better compatibility
RUN apk add --no-cache libc6-compat curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build the Next.js application (skip type checking - errors handled in next.config.mjs)
ENV SKIP_ENV_VALIDATION=1
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
# Disable parallel builds to avoid crashes
RUN npm run build -- --experimental-build-mode=compile

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# Set environment to production
ENV NODE_ENV=production

# Start the Next.js application
CMD ["npm", "run", "start"]
