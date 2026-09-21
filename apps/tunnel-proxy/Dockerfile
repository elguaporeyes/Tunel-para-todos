FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json ./
COPY packages/common/package.json ./packages/common/
COPY apps/tunnel-proxy/package.json ./apps/tunnel-proxy/

RUN npm install --workspace=apps/tunnel-proxy --workspace=packages/common --omit=dev

COPY packages/common ./packages/common
COPY apps/tunnel-proxy ./apps/tunnel-proxy

EXPOSE 8080

CMD ["node", "apps/tunnel-proxy/src/index.js"]
