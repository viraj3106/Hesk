require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
app.use(cors());

// Serve static frontend files from 'public' directory
app.use(express.static('public'));

// Proxy API requests to Spring Boot backend on port 8080
app.use((req, res) => {
  const targetPort = process.env.SPRING_BOOT_PORT || 8080;
  const options = {
    hostname: 'localhost',
    port: targetPort,
    path: req.originalUrl,
    method: req.method,
    headers: { ...req.headers }
  };

  // Remove host header to avoid routing issues in Spring Boot
  delete options.headers.host;

  const proxyReq = http.request(options, (proxyRes) => {
    res.status(proxyRes.statusCode);
    for (const key in proxyRes.headers) {
      res.setHeader(key, proxyRes.headers[key]);
    }
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxyReq, { end: true });

  proxyReq.on('error', (err) => {
    console.error('Proxy error forwarding to Spring Boot:', err.message);
    res.status(502).json({ error: 'Proxy error: Spring Boot backend is not running or unreachable.' });
  });
});

const initDb = async () => {};

// Start Server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`Node-to-Java Proxy Server running on port ${PORT}`);
    });
  }).catch(err => {
    console.error('Failed to initialize database:', err);
  });
}

module.exports = app; // For testing
