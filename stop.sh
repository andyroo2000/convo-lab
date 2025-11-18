#!/bin/bash

# LanguageFlow Studio Stop Script
# Gracefully stops server and client processes

set -e

echo "🛑 LanguageFlow Studio Shutdown"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to kill process by PID
kill_pid() {
    local pid=$1
    local name=$2

    if ps -p $pid > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Stopping $name (PID: $pid)...${NC}"
        kill $pid 2>/dev/null || kill -9 $pid 2>/dev/null || true
        sleep 1

        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${RED}❌ Failed to stop $name${NC}"
            return 1
        else
            echo -e "${GREEN}✅ $name stopped${NC}"
            return 0
        fi
    else
        echo -e "${BLUE}ℹ️  $name is not running${NC}"
        return 0
    fi
}

# Stop server
if [ -f logs/server.pid ]; then
    SERVER_PID=$(cat logs/server.pid)
    kill_pid $SERVER_PID "Server"
    rm -f logs/server.pid
else
    echo -e "${BLUE}ℹ️  No server PID file found${NC}"
fi

echo ""

# Stop client
if [ -f logs/client.pid ]; then
    CLIENT_PID=$(cat logs/client.pid)
    kill_pid $CLIENT_PID "Client"
    rm -f logs/client.pid
else
    echo -e "${BLUE}ℹ️  No client PID file found${NC}"
fi

echo ""

# Clean up any remaining processes on the ports
echo "🧹 Cleaning up any lingering processes..."
echo ""

# Function to kill processes on a port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)

    if [ -n "$pids" ]; then
        echo -e "${YELLOW}⚠️  Killing processes on port $port...${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✅ Port $port cleared${NC}"
    else
        echo -e "${BLUE}ℹ️  Port $port is free${NC}"
    fi
}

kill_port 3001  # Server port
kill_port 5173  # Vite dev server (client)
kill_port 3000  # Alternative client port

echo ""
echo "================================"
echo -e "${GREEN}✅ LanguageFlow Studio stopped${NC}"
echo ""
echo -e "${BLUE}💡 To start again, run: ./start.sh${NC}"
echo ""
