# Panther backend

## Start the app

Run http server (can run many times behind load balancer)
```
npm run start
```

Run permissions generation (should run only once - other running instances would be useless)
```
npm run permissions:start
```
(this is currently not necessary as permissions run as part of main app temporarily)
