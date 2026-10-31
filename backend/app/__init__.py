"""Flask gateway and Python AI service.
Persistent records stay in Netlify Database through the authenticated data API.
Identity performs password hashing/JWT verification; Flask never stores passwords.
"""
import os
from datetime import datetime, timezone
from urllib.parse import urlparse
import requests
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from .ai.delay import predict_delay

ALLOWED_PREFIXES = {'bootstrap', 'session', 'institutions', 'applications', 'documents', 'compliance',
                    'notifications', 'ai', 'escalations', 'settings', 'users', 'bureaus', 'profile'}

def create_app():
    app = Flask(__name__)
    app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024
    upstream = os.environ.get('NETLIFY_DATA_API_ORIGIN', '').rstrip('/')
    parsed = urlparse(upstream)
    if not parsed.hostname or parsed.scheme not in {'http', 'https'}:
        raise RuntimeError('Set NETLIFY_DATA_API_ORIGIN to your Netlify deployment or local Netlify server origin.')
    if parsed.scheme != 'https' and parsed.hostname not in {'localhost', '127.0.0.1'}:
        raise RuntimeError('The data API origin must use HTTPS outside local development.')
    frontend_origin = os.environ.get('FRONTEND_ORIGIN', 'http://localhost:8889')
    CORS(app, resources={r'/api/*': {'origins': [frontend_origin]}}, supports_credentials=True)

    def forward(path, method=None):
        # Only a fixed trusted origin is used. User input cannot choose a host.
        headers = {key: request.headers[key] for key in ['Cookie', 'Authorization', 'Content-Type'] if key in request.headers}
        return requests.request(method or request.method, f'{upstream}/api/{path}',
                                params=request.args, headers=headers,
                                data=request.get_data() if method is None and request.method not in {'GET', 'HEAD'} else None,
                                timeout=25, allow_redirects=False)

    @app.get('/health')
    def health():
        return jsonify(status='ok', service='Approval360 Flask + Python AI', persistence='Netlify Database via authenticated API')

    @app.route('/api/<path:path>', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
    def api(path):
        if path.split('/')[0] not in ALLOWED_PREFIXES or '..' in path or '\\' in path:
            return jsonify(error='API endpoint not found.'), 404
        if request.method == 'OPTIONS':
            return Response(status=204)
        response = forward(path)
        if path.startswith('ai/') and request.method == 'GET' and response.status_code == 200:
            result = response.json()
            # The data API authorizes this request before Python reads any operational data.
            bootstrap = forward('bootstrap', 'GET')
            if bootstrap.status_code != 200:
                return jsonify(error='Could not load authorized prediction inputs.'), 503
            payload = bootstrap.json()
            app_id = path.split('/')[1]
            application = next((row for row in payload['applications'] if row['id'] == app_id), None)
            if application is None:
                return jsonify(error='Application not found.'), 404
            now = datetime.now(timezone.utc)
            parse = lambda value: datetime.fromisoformat(value.replace('Z', '+00:00'))
            features = {'missing_documents': len(result['missing']), 'violations': result['violations'],
                        'pending_days': max(0, (now - parse(application['createdAt'])).days),
                        'compliance_score': result['score'],
                        'days_to_deadline': (parse(application['deadline']) - now).days}
            if application['status'] not in {'Approved', 'Rejected'}:
                result.update(predict_delay(features))
                result['reasons'].append('Delay is predicted from missing evidence, compliance violations, age, score, and deadline proximity; the model learned from synthetic data only.')
            return jsonify(result)
        output = Response(response.content, status=response.status_code)
        for key in ['Content-Type', 'Content-Disposition', 'Cache-Control', 'Content-Security-Policy', 'X-Content-Type-Options']:
            if key in response.headers:
                output.headers[key] = response.headers[key]
        for value in response.raw.headers.getlist('Set-Cookie'):
            output.headers.add('Set-Cookie', value)
        output.headers['Cache-Control'] = 'private, no-store'
        return output

    @app.errorhandler(requests.RequestException)
    def unavailable(_error):
        return jsonify(error='The managed data service is unavailable. Try again shortly.'), 503

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error='Upload exceeds the request size limit. PDFs must be under 4 MB.'), 413

    return app
