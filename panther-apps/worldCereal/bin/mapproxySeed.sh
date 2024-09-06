#!/bin/bash

for conf in $(docker-compose exec mapproxy find ./seed -type f -name 'WorldCereal_*.yaml' -printf "%f\n" | tr -d '\r')
do
    docker-compose exec mapproxy mapproxy-seed -f conf/$conf -s seed/$conf -c 4 --use-cache-lock --seed=product
done
