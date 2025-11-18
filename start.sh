#!/bin/bash

# LanguageFlow Studio Startup Script
# Kills existing processes and starts server + client cleanly

set -e  # Exit on error

echo "🚀 LanguageFlow Studio Startup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to kill processes by name pattern
kill_by_name() {
    local pattern=$1
    local pids=$(pgrep -f "$pattern" 2>/dev/null)

    if [ -n "$pids" ]; then
        echo -e "${YELLOW}⚠️  Killing processes matching: $pattern${NC}"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}✅ Processes killed${NC}"
    fi
}

echo "🧹 Cleaning up existing processes..."
echo ""

# Kill processes on common ports
kill_port 3001  # Server port
kill_port 5173  # Vite dev server (client)
kill_port 3000  # Alternative client port

# Kill any lingering tsx/vite processes
kill_by_name "tsx watch"
kill_by_name "vite"
kill_by_name "node.*languageflow"

echo ""
echo "🔍 Checking dependencies..."
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Check if server directory exists
if [ ! -d "server" ]; then
    echo -e "${RED}❌ Error: server directory not found${NC}"
    exit 1
fi

# Check if client directory exists
if [ ! -d "client" ]; then
    echo -e "${RED}❌ Error: client directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Project structure verified${NC}"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required commands
if ! command_exists node; then
    echo -e "${RED}❌ Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ Error: npm is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js and npm found${NC}"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ] || [ ! -d "client/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    cd server && npm install && cd ..
    cd client && npm install && cd ..
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    echo ""
fi

# Create log directory
mkdir -p logs

echo "🚀 Starting services..."
echo ""

# Start server
echo -e "${BLUE}🔧 Starting server on port 3001...${NC}"
cd server
npm run dev > ../logs/server.log 2>&1 &
SERVER_PID=$!
cd ..
echo -e "${GREEN}✅ Server starting (PID: $SERVER_PID)${NC}"

# Wait a bit for server to start
sleep 3

# Check if server is running
if ! lsof -ti:3001 >/dev/null 2>&1; then
    echo -e "${RED}❌ Server failed to start. Check logs/server.log${NC}"
    tail -20 logs/server.log
    exit 1
fi

echo -e "${GREEN}✅ Server is running on http://localhost:3001${NC}"
echo ""

# Start client
echo -e "${BLUE}🎨 Starting client on port 5173...${NC}"
cd client
npm run dev > ../logs/client.log 2>&1 &
CLIENT_PID=$!
cd ..
echo -e "${GREEN}✅ Client starting (PID: $CLIENT_PID)${NC}"

# Wait a bit for client to start
sleep 3

# Check if client is running
if ! lsof -ti:5173 >/dev/null 2>&1; then
    echo -e "${RED}❌ Client failed to start. Check logs/client.log${NC}"
    tail -20 logs/client.log
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Client is running on http://localhost:5173${NC}"
echo ""

# Create PID file for easy cleanup later
echo "$SERVER_PID" > logs/server.pid
echo "$CLIENT_PID" > logs/client.pid

echo "================================"
echo -e "${GREEN}✅ LanguageFlow Studio is ready!${NC}"
echo ""
echo -e "${BLUE}📍 URLs:${NC}"
echo "   Client:  http://localhost:5173"
echo "   Server:  http://localhost:3001"
echo "   API:     http://localhost:3001/api"
echo ""
echo -e "${BLUE}📝 Logs:${NC}"
echo "   Server:  logs/server.log"
echo "   Client:  logs/client.log"
echo ""
echo -e "${BLUE}🛑 To stop:${NC}"
echo "   Run: ./stop.sh"
echo "   Or:  kill $SERVER_PID $CLIENT_PID"
echo ""
echo -e "${YELLOW}⌨️  Press Ctrl+C to view logs (services will keep running in background)${NC}"
echo ""

# Follow logs (optional - user can Ctrl+C to exit)
tail -f logs/server.log logs/client.log
