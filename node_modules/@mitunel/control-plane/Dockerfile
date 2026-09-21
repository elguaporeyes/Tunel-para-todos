FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json ./
COPY packages/common/package.json ./packages/common/
COPY apps/control-plane/package.json ./apps/control-plane/

RUN npm install --workspace=apps/control-plane --workspace=packages/common --omit=dev

COPY packages/common ./packages/common
COPY apps/control-plane ./apps/control-plane

EXPOSE 4000

CMD ["node", "apps/control-plane/src/server.js"]
