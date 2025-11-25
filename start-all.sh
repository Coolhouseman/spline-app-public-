#!/bin/bash

# Start backend server on port 8082 in the background
PORT=8082 npx tsx server/index.ts &

# Start Expo dev server
EXPO_PACKAGER_PROXY_URL=https://$REPLIT_DEV_DOMAIN REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN npx expo start
