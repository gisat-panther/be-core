FROM node:lts

WORKDIR /usr/src/app

COPY . .

RUN npm ci --production-only

EXPOSE 9850-9859

CMD [ "node", "./src/server.js" ]