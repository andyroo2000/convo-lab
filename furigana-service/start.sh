#!/bin/bash

# Furigana Service Startup Script

echo "Starting Furigana Generation Service..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Start the service
echo "Starting FastAPI server on http://localhost:8000"
python main.py
