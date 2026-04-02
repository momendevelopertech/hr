const http = require('http');
const https = require('https');
const { URL } = require('url');

const port = Number.parseInt(process.env.PORT || '8080', 10);
const targetBase = process.env.EVOLUTION_TARGET_URL || 'http://127.0.0.1:8081';
const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'sphinxhr';
const apiKey = process.env.EVOLUTION_API_KEY || '';

const target = new URL(targetBase);
const client = target.protocol === 'https:' ? https : http;

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function buildUpstreamPath(reqUrl) {
  const incoming = new URL(reqUrl, `http://127.0.0.1:${port}`);
  let pathname = incoming.pathname;

  // HR currently posts to /message/sendText with no instance segment.
  if (/^\/message\/[^/]+$/i.test(pathname)) {
    pathname = `${pathname}/${encodeURIComponent(instanceName)}`;
  }

  return `${pathname}${incoming.search}`;
}

function filterHeaders(headers, bodyLength) {
  const next = {};

  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (['host', 'content-length', 'connection', 'expect'].includes(lower)) {
      continue;
    }

    if (value !== undefined) {
      next[key] = value;
    }
  }

  if (apiKey && !next.apikey) {
    next.apikey = apiKey;
  }

  if (bodyLength > 0) {
    next['content-length'] = String(bodyLength);
  }

  return next;
}

function writeJson(res, statusCode, payload) {
  const json = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

async function handleRequest(req, res) {
  try {
    if (req.url === '/__bridge/health') {
      return writeJson(res, 200, {
        ok: true,
        port,
        target: targetBase,
        instanceName,
        hasApiKey: Boolean(apiKey),
      });
    }

    const body = await collectBody(req);
    const upstreamPath = buildUpstreamPath(req.url || '/');
    const headers = filterHeaders(req.headers, body.length);

    const upstreamReq = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port,
        method: req.method,
        path: upstreamPath,
        headers,
      },
      (upstreamRes) => {
        const responseHeaders = { ...upstreamRes.headers };
        delete responseHeaders['transfer-encoding'];
        res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
        upstreamRes.pipe(res);
      },
    );

    upstreamReq.on('error', (error) => {
      writeJson(res, 502, {
        ok: false,
        error: 'Failed to reach upstream Evolution API',
        details: error.message,
        target: `${target.protocol}//${target.host}${upstreamPath}`,
      });
    });

    if (body.length > 0) {
      upstreamReq.write(body);
    }

    upstreamReq.end();
  } catch (error) {
    writeJson(res, 500, {
      ok: false,
      error: 'Bridge server error',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

const server = http.createServer(handleRequest);

server.on('checkContinue', (req, res) => {
  res.writeContinue();
  handleRequest(req, res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(
    `[evolution-bridge] listening on http://127.0.0.1:${port} -> ${targetBase} (instance=${instanceName})`,
  );
});
