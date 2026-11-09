# ==============================================================================
# TUM Sovereign Corridor Gateway — Commercial Turnkey Standalone Appliance
# Multi-Stage Hardened Production Dockerfile
# Base OS: Alpine Linux 3.21 / Node.js 22 LTS
# Target Environment: Airport E-Gates, Border Checkpoints, Air-Gapped Kiosks
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build & Compilation Stage
# ------------------------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /build

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package manifests and install all dependencies (including dev)
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy full source and test suites for compilation and verification
COPY src ./src
COPY tests ./tests
COPY data ./data

# Compile TypeScript to JavaScript in /build/dist
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 2: Hardened Production Runtime Appliance Stage
# ------------------------------------------------------------------------------
FROM node:22-alpine AS runner

LABEL maintainer="TUM Group Holdings <daywakler01@gmail.com>"
LABEL product="TUM Sovereign Corridor Gateway"
LABEL classification="National Critical Infrastructure Appliance"
LABEL version="1.0.0"

WORKDIR /app

# Appliance runtime environment variables
ENV NODE_ENV=production
ENV PORT=8088
ENV APPLIANCE_ID=TUM-SOVEREIGN-CORRIDOR-01
ENV CORRIDOR_GATE_ID=BKK-SUVARNABHUMI-T1-GATE01
ENV AIRPORT_CODE=BKK
ENV ICAO_CERTS_DIR=/app/certs
ENV EDGE_STORAGE_DIR=/app/data
ENV AUDIT_STORAGE_DIR=/app/audit
ENV BIOMETRIC_MATCH_THRESHOLD=0.85
ENV BIOMETRIC_LIVENESS_THRESHOLD=0.90
ENV PQC_SECURITY_LEVEL=ML-DSA-65

# Create dedicated non-root sovereign service user & group
RUN addgroup -g 10001 sovereign && \
    adduser -D -u 10001 -G sovereign -h /app sovereign

# Create appliance directories for data, trust anchors, and audit trails
RUN mkdir -p /app/data /app/certs /app/audit /app/config && \
    chown -R sovereign:sovereign /app

# Copy production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output from builder
COPY --from=builder --chown=sovereign:sovereign /build/dist ./dist

# Copy default ICAO PKD Master List & CSCA Trust Anchors
COPY --from=builder --chown=sovereign:sovereign /build/data/icao-pki/ ./certs/

# Expose HTTP REST API & Web HUD Dashboard port
EXPOSE 8088

# Switch to non-root sovereign user
USER sovereign

# Health check verifying API readiness and trust store health
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8088/health || exit 1

# Launch Sovereign Corridor Gateway API server
CMD ["node", "dist/src/presentation/api/server.js"]
