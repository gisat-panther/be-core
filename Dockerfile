FROM ubuntu

ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_MAJOR=20

RUN apt-get update \
    && apt-get install -y curl gdal-bin postgresql-client git ca-certificates gnupg

RUN mkdir -p /etc/apt/keyrings

RUN curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg

RUN echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list

RUN apt-get update \
    && apt-get install -y nodejs

WORKDIR /usr/src/app

COPY . .

RUN npm ci --production-only

EXPOSE 9850

CMD [ "node", "./src/server.js" ]