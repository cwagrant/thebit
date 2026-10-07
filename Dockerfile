# Builds thebit (API server + built client) into one image. See
# deploy/docker-compose.yml for running it alongside a tunnel server.

FROM node:24-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 and isolated-vm are native modules - these are only needed
# when no prebuilt binary matches, but without them that case fails the build.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev


FROM node:24-bookworm-slim
ENV NODE_ENV=production

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/server/thebit.config.js /app/server/thebit.config.js
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir /data && chown node:node /data

# thebit keeps everything it writes - the database, the secrets key - in its
# working directory, and reads thebit.config.js and .env from there too. So
# the working directory is the volume, not the app directory.
USER node
WORKDIR /data
VOLUME /data

EXPOSE 3131
ENTRYPOINT ["docker-entrypoint.sh"]
# isolated-vm (which runs listener rules) needs --no-node-snapshot.
CMD ["node", "--no-node-snapshot", "/app/dist/server/index.js"]
