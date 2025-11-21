"""
Cloud Functions entry point for furigana service
"""
import functions_framework
from main import app

@functions_framework.http
def furigana(request):
    """HTTP Cloud Function entry point"""
    from fastapi.responses import JSONResponse
    import json

    # Handle CORS preflight
    if request.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }
        return ('', 204, headers)

    # Route to FastAPI app
    from asgiref.sync import async_to_sync
    from fastapi.testclient import TestClient

    client = TestClient(app)

    # Forward the request
    if request.method == 'POST':
        response = client.post(request.path or '/furigana', json=request.get_json())
    elif request.method == 'GET':
        response = client.get(request.path or '/')
    else:
        response = client.request(request.method, request.path or '/')

    headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    }

    return (response.content, response.status_code, headers)
