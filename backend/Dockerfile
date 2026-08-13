FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy source
COPY . .

EXPOSE 3001

CMD ["node", "-r", "dotenv/config", "index.js"]
