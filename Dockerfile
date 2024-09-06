FROM ubuntu

ARG DEBIAN_FRONTEND=noninteractive

RUN apt update \
    && apt upgrade -y \
    && apt install -y \
        curl \
        gdal-bin \
        postgresql-client \
        git \
        ca-certificates \
        gnupg

RUN cd /tmp \
    && curl -fsSL https://deb.nodesource.com/setup_20.x -o nodesource_setup.sh \
    && /bin/bash nodesource_setup.sh \
    && apt update \
    && apt install nodejs

RUN useradd -m -s /bin/bash node

USER node

RUN mkdir -pv /home/node/app

WORKDIR /home/node/app

COPY --chown=node . .

RUN npm ci --production-only

EXPOSE 9850

CMD [ "node", "./src/server.js" ]