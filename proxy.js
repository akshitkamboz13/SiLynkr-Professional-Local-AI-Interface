require('dotenv').config();

const fs = require('fs');
const https = require('https');
const httpProxy = require('http-proxy');

const HTTPS_PORT = Number(process.env.OLLAMA_HTTPS_PROXY_PORT || 11443);
const TARGET = process.env.OLLAMA_PROXY_TARGET || 'http://127.0.0.1:11434';
const CERT_FILE = process.env.OLLAMA_PROXY_CERT || 'localhost.pem';
const KEY_FILE = process.env.OLLAMA_PROXY_KEY || 'localhost-key.pem';

const allowedOrigins = (process.env.OLLAMA_PROXY_ALLOWED_ORIGINS || 'http://localhost:49494')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const certOptions = {
  key: fs.readFileSync(KEY_FILE),
  cert: fs.readFileSync(CERT_FILE),
};

const proxy = httpProxy.createProxyServer({
  target: TARGET,
  changeOrigin: true,
  xfwd: true,
  secure: false,
});

const resolveAllowOrigin = (origin) => {
  if (!origin) {
    return allowedOrigins[0] || '*';
  }

  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    return origin;
  }

  return allowedOrigins[0] || '*';
};

const setCorsHeaders = (req, res) => {
  const requestOrigin = req.headers.origin;
  const allowOrigin = resolveAllowOrigin(requestOrigin);

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');
};

proxy.on('proxyRes', (proxyRes, req) => {
  const requestOrigin = req.headers.origin;
  const allowOrigin = resolveAllowOrigin(requestOrigin);

  proxyRes.headers['Access-Control-Allow-Origin'] = allowOrigin;
  proxyRes.headers['Vary'] = 'Origin';
  proxyRes.headers['Access-Control-Allow-Private-Network'] = 'true';
  proxyRes.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS';
  proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
});

proxy.on('error', (error, req, res) => {
  console.error('[ollama-https-proxy] proxy error:', error.message);

  if (!res.headersSent) {
    setCorsHeaders(req, res);
    res.writeHead(502, { 'Content-Type': 'application/json' });
  }

  res.end(
    JSON.stringify({
      error: 'Proxy request failed',
      details: error.message,
      target: TARGET,
    })
  );
});

const server = https.createServer(certOptions, (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  proxy.web(req, res);
});

server.listen(HTTPS_PORT, () => {
  console.log('[ollama-https-proxy] running');
  console.log(`[ollama-https-proxy] listen: https://localhost:${HTTPS_PORT}`);
  console.log(`[ollama-https-proxy] target: ${TARGET}`);
  console.log(`[ollama-https-proxy] allowed origins: ${allowedOrigins.join(', ') || '(none)'}`);
});
