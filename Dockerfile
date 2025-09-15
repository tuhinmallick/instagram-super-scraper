FROM apify/actor-node-playwright-chrome:20

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install --only=production --no-optional

# Copy ALL files (including src directory)
COPY . ./

# Change the start command to point to your actual main file
CMD node src/main.js