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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

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
kill_port 8001  # Pinyin service port

# Kill any lingering tsx/vite processes
kill_by_name "tsx watch"
kill_by_name "vite"
kill_by_name "node.*languageflow"
kill_by_name "python3.*main.py"  # Pinyin service

echo ""
echo "🐳 Starting Docker services (PostgreSQL & Redis)..."
echo ""

# Start PostgreSQL and Redis in the background
if command_exists docker-compose || command_exists docker; then
    if command_exists docker-compose; then
        docker-compose up -d postgres redis
    else
        docker compose up -d postgres redis
    fi
    echo -e "${GREEN}✅ PostgreSQL and Redis started${NC}"
    sleep 3  # Wait for services to be ready
else
    echo -e "${RED}❌ Error: Docker is not installed${NC}"
    exit 1
fi

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

# Start Pinyin service
echo -e "${BLUE}🀄 Starting Pinyin service on port 8001...${NC}"
if [ -d "pinyin-service" ] && command_exists python3; then
    cd pinyin-service
    pip3 install -q -r requirements.txt
    python3 main.py > ../logs/pinyin.log 2>&1 &
    PINYIN_PID=$!
    cd ..
    echo -e "${GREEN}✅ Pinyin service starting (PID: $PINYIN_PID)${NC}"
    sleep 2

    # Check if pinyin service is running
    if lsof -ti:8001 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Pinyin service is running on http://localhost:8001${NC}"
    else
        echo -e "${YELLOW}⚠️  Pinyin service failed to start. Chinese language support may not work.${NC}"
        echo -e "${YELLOW}   Check logs/pinyin.log for details${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Pinyin service not found or Python 3 not installed. Skipping...${NC}"
fi
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
if [ -n "$PINYIN_PID" ]; then
    echo "$PINYIN_PID" > logs/pinyin.pid
fi

echo "================================"
echo -e "${GREEN}✅ ConvoLab is ready!${NC}"
echo ""
echo -e "${GREEN}🌐 Open your browser to:${NC}"
echo -e "   ${GREEN}http://localhost:5173${NC}"
echo ""
echo -e "${BLUE}📍 Additional URLs:${NC}"
echo "   Server:  http://localhost:3001"
echo "   API:     http://localhost:3001/api"
if [ -n "$PINYIN_PID" ]; then
    echo "   Pinyin:  http://localhost:8001"
fi
echo ""
echo -e "${BLUE}📝 Logs:${NC}"
echo "   Server:  logs/server.log"
echo "   Client:  logs/client.log"
if [ -n "$PINYIN_PID" ]; then
    echo "   Pinyin:  logs/pinyin.log"
fi
echo ""
echo -e "${BLUE}🛑 To stop:${NC}"
echo "   Run: ./stop.sh"
if [ -n "$PINYIN_PID" ]; then
    echo "   Or:  kill $SERVER_PID $CLIENT_PID $PINYIN_PID"
else
    echo "   Or:  kill $SERVER_PID $CLIENT_PID"
fi
echo ""
echo -e "${YELLOW}⌨️  Press Ctrl+C to view logs (services will keep running in background)${NC}"
echo ""

# Follow logs (optional - user can Ctrl+C to exit)
tail -f logs/server.log logs/client.log
