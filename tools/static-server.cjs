const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(__dirname, '..', 'deploy');
const port = Number(process.env.PORT || 8765);
const host = '127.0.0.1';

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8'
};

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded.endsWith('/') ? `${decoded}index.html` : decoded;
  const filePath = path.resolve(root, `.${relative}`);
  return filePath.startsWith(`${root}${path.sep}`) ? filePath : null;
}

const server = http.createServer((request, response) => {
  const filePath = resolveRequestPath(request.url || '/');
  if (!filePath) {
    response.writeHead(400).end('Bad request');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    const resolvedPath = !statError && stats.isDirectory()
      ? path.join(filePath, 'index.html')
      : filePath;

    fs.readFile(resolvedPath, (readError, content) => {
      if (readError) {
        response.writeHead(readError.code === 'ENOENT' ? 404 : 500).end('Not found');
        return;
      }

      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': mimeTypes[path.extname(resolvedPath).toLowerCase()] || 'application/octet-stream'
      });
      response.end(content);
    });
  });
});

server.listen(port, host, () => {
  console.log(`Apartmani Balent test server: http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
