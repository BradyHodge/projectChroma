# Use the official Node.js image as base
FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Bundle app source
COPY . .

# Set environment variables with default values that can be overridden
ENV DB_URL=postgres://user:password@localhost:5432/dbname
ENV NODE_ENV=development
ENV PORT=3000
ENV SESSION_SECRET=your_random_string_here

# Expose the port the app runs on
EXPOSE $PORT

# Command to run the application
CMD ["node", "server.js"]