import './src/index.js';
import http from 'http';

const server = http.createServer(app => {
  app.get('/api/health', (req, res) => {
    // We'll just test after server starts
  });
});

console.log('Verification script loaded');