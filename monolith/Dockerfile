FROM node:20-alpine

WORKDIR /app

# Instalar dependencias primero para cache de Docker
COPY package*.json ./
RUN npm install --production

# Copiar código fuente
COPY . .

# Exponer el puerto del Monolito
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
