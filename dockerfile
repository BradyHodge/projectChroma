FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
ENV DB_URL=postgres://postgres:password@postgres:5432/postgres
ENV NODE_ENV=development
ENV PORT=3000
ENV SESSION_SECRET=your_random_string_here
EXPOSE $PORT
CMD ["node", "server.js"]