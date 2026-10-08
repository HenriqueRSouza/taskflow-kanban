FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY web/package.json ./web/package.json
COPY api/package.json ./api/package.json
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "web", "--", "--host", "0.0.0.0"]
