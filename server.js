const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

// MIME types
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.vrm': 'application/octet-stream',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  
  // Handle /assets/js/main-*.js -> serve our main JS
  if (url.startsWith('/assets/js/main-')) {
    const filePath = path.join(ROOT, 'samsy-main.js');
    serveFile(res, filePath, '.js');
    return;
  }

  // Handle /assets/js/*.js -> other chunks
  if (url.startsWith('/assets/js/')) {
    const filename = path.basename(url);
    const filePath = path.join(ROOT, filename === 'main-ITpbzWAg.js' ? 'samsy-main.js' : `samsy-${filename}`);
    if (fs.existsSync(filePath)) {
      serveFile(res, filePath, '.js');
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // Handle /assets/css/main-*.css
  if (url.startsWith('/assets/css/main-')) {
    const filePath = path.join(ROOT, 'samsy-main.css');
    serveFile(res, filePath, '.css');
    return;
  }

  // Handle all assets (models, textures, sounds, etc.)
  if (url.startsWith('/assets/')) {
    const filePath = path.join(ROOT, url);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      serveFile(res, filePath, ext);
    } else {
      // try with original path from website
      const altPath = path.join(ROOT, url.replace(/^\/assets\//, ''));
      if (fs.existsSync(altPath)) {
        const ext = path.extname(altPath);
        serveFile(res, altPath, ext);
      } else {
        res.writeHead(404);
        res.end('Not found: ' + url);
      }
    }
    return;
  }

  // Handle root -> index.html
  if (url === '/' || url === '/index.html') {
    const filePath = path.join(ROOT, 'index.html');
    serveFile(res, filePath, '.html');
    return;
  }

  // Fallback: serve static file
  const filePath = path.join(ROOT, url);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    serveFile(res, filePath, ext);
  } else {
    // SPA fallback
    const indexPath = path.join(ROOT, 'index.html');
    serveFile(res, indexPath, '.html');
  }
});

function serveFile(res, filePath, ext) {
  const mimeType = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Server error');
      return;
    }
    res.writeHead(200, {
      'Content-Type': mimeType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${ROOT}`);
});
