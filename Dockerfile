# Use the official Apify base image with Node.js and Playwright
FROM apify/actor-node-playwright-chrome:18

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production \
    && npm cache clean --force

# Copy source code
COPY . ./

# Set the start command
CMD npm start