FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx tailwindcss -i ./assets/css/input.css -o ./assets/css/style.css --minify

EXPOSE 3000

CMD ["node", "server.js"]
