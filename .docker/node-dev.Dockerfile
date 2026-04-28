FROM node:24.15.0-bookworm-slim

RUN corepack enable && corepack prepare pnpm@10.33.2 --activate

WORKDIR /workspace
