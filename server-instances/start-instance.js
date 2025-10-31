const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '..', '..', 'Platefull', 'server', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('✅ Loaded environment from Platefull project');
} else {
  process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/platefull-lb-demo';
  process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
  console.log('⚠️  Using default environment variables (Platefull .env not found)');
}

const PORT = process.argv[2] || 5001;
const INSTANCE_NAME = `Platefull-Instance-${PORT}`;

console.log('╔════════════════════════════════════════════════════════════╗');
console.log(`║       ${INSTANCE_NAME.padEnd(49)} ║`);
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

const app = express();

const configuredOrigin = process.env.FRONTEND_URL;
const localhostRegex = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (
      (configuredOrigin && origin === configuredOrigin) ||
      localhostRegex.test(origin)
    ) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(express.json());

const uploadsPath = path.join(__dirname, '..', '..', 'Platefull', 'server', 'uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
}

if (!process.env.MONGO_URI) {
  console.log('⚠️  MongoDB URI not set. Using in-memory mock mode.');
  console.log('   The server will work without a database connection.');
} else {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => {
      console.log(`✅ MongoDB Connected (Instance ${PORT})`);
    })
    .catch((err) => {
      console.log(`⚠️  MongoDB connection failed (Instance ${PORT}): ${err?.message}`);
      console.log('   The server will continue in mock mode.');
    });
}

app.post('/api/auth/register', (req, res) => {
  res.json({ success: true, message: 'Registration endpoint', instance: INSTANCE_NAME });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ success: true, message: 'Login endpoint', instance: INSTANCE_NAME });
});

app.get('/api/food', (req, res) => {
  res.json({ success: true, message: 'Food list endpoint', instance: INSTANCE_NAME, data: [] });
});

app.post('/api/food', (req, res) => {
  res.json({ success: true, message: 'Create food endpoint', instance: INSTANCE_NAME });
});

app.get('/api/offer', (req, res) => {
  res.json({ success: true, message: 'Offers endpoint', instance: INSTANCE_NAME, data: [] });
});

console.log('✅ Mock API routes loaded (Auth, Food, Offer)');
console.log('   Note: To use real Platefull routes, integrate with the actual project');

app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: `Server instance ${PORT} is running`,
    server: `http://localhost:${PORT}`,
    instance: INSTANCE_NAME,
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    },
    headers: {
      'x-load-balancer': req.headers['x-load-balancer'] || 'direct',
      'x-lb-algorithm': req.headers['x-lb-algorithm'] || 'none'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: `Server instance ${PORT} is running`,
    server: `http://localhost:${PORT}`,
    instance: INSTANCE_NAME,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/debug', (req, res) => {
  res.json({
    success: true,
    message: 'Debug endpoint working',
    instance: INSTANCE_NAME,
    port: PORT,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      FRONTEND_URL: process.env.FRONTEND_URL,
      MONGO_URI: process.env.MONGO_URI ? 'Set' : 'Not set',
      APPWRITE_PROJECT_ID: process.env.APPWRITE_PROJECT_ID ? 'Set' : 'Not set'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/api/instance', (req, res) => {
  res.json({
    success: true,
    instance: INSTANCE_NAME,
    port: PORT,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    instance: INSTANCE_NAME,
    port: PORT,
    path: req.path
  });
});

app.use((err, req, res, next) => {
  console.error(`❌ Error in instance ${PORT}:`, err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    instance: INSTANCE_NAME,
    error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log(`║       ${INSTANCE_NAME} - READY`.padEnd(59) + '║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server URL:         http://localhost:${PORT}`);
  console.log(`💚 Health Check:       http://localhost:${PORT}/api/health`);
  console.log(`🔍 Debug Endpoint:     http://localhost:${PORT}/api/debug`);
  console.log(`📊 Instance Info:      http://localhost:${PORT}/api/instance`);
  console.log('');
  console.log(`✅ Instance is ready to accept requests!`);
  console.log('');
});

process.on('SIGINT', () => {
  console.log('');
  console.log(`🛑 Shutting down ${INSTANCE_NAME}...`);
  mongoose.connection.close().then(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('');
  console.log(`🛑 Shutting down ${INSTANCE_NAME}...`);
  mongoose.connection.close().then(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});
