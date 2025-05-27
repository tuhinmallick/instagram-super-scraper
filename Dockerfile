FROM apify/actor-node-playwright-chrome:20

COPY package*.json ./
RUN npm install --only=production --no-optional

COPY . ./

CMD npm start