# backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["sh", "entrypoint.sh"]
