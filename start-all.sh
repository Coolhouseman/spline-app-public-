#!/bin/bash
npx concurrently "PORT=3000 npx ts-node --project tsconfig.server.json server/index.ts" "EXPO_PACKAGER_PROXY_URL=https://$REPLIT_DEV_DOMAIN REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN npx expo start"
