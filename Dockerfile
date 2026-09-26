FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci
COPY client client
COPY server server
RUN npm run build
# The Node command reads this empty file; actual config comes from Compose env.
RUN touch server/.env && chown -R node:node /app
USER node
EXPOSE 4000
CMD ["npm", "start"]
