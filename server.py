import http.server
import os
import mimetypes

PORT = 3001
ROOT = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        # Cross-origin isolation: required for SharedArrayBuffer (Draco, OffscreenCanvas)
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def do_GET(self):
        # serve index.html for root
        if self.path == '/' or self.path == '':
            self.path = '/index.html'
        return super().do_GET()


if __name__ == '__main__':
    mimetypes.add_type('model/gltf-binary', '.glb')
    mimetypes.add_type('application/octet-stream', '.vrm')
    mimetypes.add_type('video/mp4', '.mp4')
    mimetypes.add_type('application/wasm', '.wasm')
    server = http.server.HTTPServer(('', PORT), Handler)
    print(f'Serving at http://localhost:{PORT}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
