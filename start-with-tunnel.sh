#!/bin/bash

TUNNEL_LOG="/tmp/cloudflared.log"
TUNNEL_URL_FILE="/tmp/tunnel_url.txt"

echo "============================================"
echo "  Split Payment App - Development Server"
echo "============================================"

cleanup() {
    echo ""
    echo "Shutting down..."
    pkill -f "cloudflared tunnel" 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

start_tunnel() {
    echo ""
    echo "Starting Cloudflare tunnel for backend..."
    pkill -f "cloudflared tunnel" 2>/dev/null
    sleep 1
    
    cloudflared tunnel --url http://127.0.0.1:8082 --protocol http2 > "$TUNNEL_LOG" 2>&1 &
    TUNNEL_PID=$!
    
    for i in {1..30}; do
        TUNNEL_URL=$(grep -o 'https://[^[:space:]]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
        if [ -n "$TUNNEL_URL" ]; then
            echo "$TUNNEL_URL" > "$TUNNEL_URL_FILE"
            echo ""
            echo "============================================"
            echo "  TUNNEL ACTIVE"
            echo "============================================"
            echo "  Backend URL: $TUNNEL_URL"
            echo ""
            echo "  To use on Expo Go (mobile):"
            echo "  1. Set this environment variable in Replit:"
            echo "     EXPO_PUBLIC_BACKEND_URL=$TUNNEL_URL"
            echo "  2. Restart the app"
            echo "============================================"
            echo ""
            export EXPO_PUBLIC_BACKEND_URL="$TUNNEL_URL"
            return 0
        fi
        sleep 1
    done
    
    echo "Warning: Could not establish tunnel connection"
    echo "Mobile bank connection will not work"
    echo "Web version will still work via localhost"
    return 1
}

start_tunnel

echo "Starting development servers..."
npm run dev
