import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const host = '127.0.0.1';
const port = Number(process.env.PORT ?? 4175);

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8']
]);

function resolvePath(url) {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  const relativePath = normalize(pathname).replace(/^[/\\]+/, '') || 'index.html';
  const filePath = resolve(join(root, relativePath));

  if (filePath !== root && !filePath.startsWith(root + sep)) {
    return null;
  }

  return filePath;
}

const server = createServer(async (request, response) => {
  const filePath = resolvePath(request.url ?? '/');

  if (!filePath) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const info = await stat(filePath);
    const target = info.isDirectory() ? join(filePath, 'index.html') : filePath;
    const type = contentTypes.get(extname(target)) ?? 'application/octet-stream';

    response.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store'
    });
    createReadStream(target).pipe(response);
  } catch {
    response.writeHead(404).end('Not Found');
  }
});

server.listen(port, host, () => {
  console.log(`Serving http://${host}:${port}/`);
});
