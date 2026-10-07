FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Hugging Face Spaces mengharapkan aplikasi di port 7860
ENV PORT=7860
EXPOSE 7860
USER node
CMD ["node", "server.js"]
