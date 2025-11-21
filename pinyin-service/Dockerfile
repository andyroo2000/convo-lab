FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY *.py ./

# Expose port
ENV PORT=8080
EXPOSE 8080

# Run with uvicorn
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
