const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const ServerPool = require('./server-pool');
const config = require('./config');
const cors = require('cors');

const app = express();
const PORT = config.loadBalancer.port;

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║       PLATEFULL LOAD BALANCER - STARTING UP               ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

// Add initial servers from configuration
config.initialServers.forEach(server => {
    ServerPool.addServer(server.url, server.weight);
});

ServerPool.startHealthChecks();

console.log('');
console.log('📊 Initial Configuration:');
console.log(`   • Algorithm: ${ServerPool.algorithm}`);
console.log(`   • Servers: ${config.initialServers.length}`);
console.log(`   • Health Check Interval: ${config.serverPool.healthCheckInterval / 1000}s`);
console.log('');

app.use('/admin', express.json());
app.use('/admin', cors());

const sseClients = [];

app.get('/admin/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    res.write('data: {"type":"connected","message":"SSE connection established"}\n\n');
    
    sseClients.push(res);
    
    req.on('close', () => {
        const index = sseClients.indexOf(res);
        if (index !== -1) {
            sseClients.splice(index, 1);
        }
    });
});

function broadcastRequestEvent(eventData) {
    const data = JSON.stringify(eventData);
    sseClients.forEach(client => {
        try {
            client.write(`data: ${data}\n\n`);
        } catch (error) {
            console.error('Error broadcasting to client:', error.message);
        }
    });
}

app.get('/admin/pool', (req, res) => {
    res.json(ServerPool.servers);
});

app.get('/admin/metrics', (req, res) => {
    res.json(ServerPool.getMetrics());
});

app.get('/admin/clients', (req, res) => {
    res.json(ServerPool.getClientDistribution());
});

app.get('/admin/algorithm', (req, res) => {
    res.json({ 
        algorithm: ServerPool.algorithm,
        availableAlgorithms: config.loadBalancer.availableAlgorithms,
        descriptions: config.algorithmDescriptions
    });
});

app.post('/admin/algorithm', (req, res) => {
    const { algorithm } = req.body;
    
    if (!algorithm) {
        return res.status(400).json({ error: 'Algorithm is required' });
    }
    
    const success = ServerPool.setAlgorithm(algorithm);
    
    if (success) {
        console.log(`[Admin] Algorithm changed to: ${algorithm}`);
        res.status(200).json({ 
            message: `Algorithm changed to ${algorithm}`, 
            algorithm: ServerPool.algorithm 
        });
    } else {
        res.status(400).json({ 
            error: 'Invalid algorithm',
            availableAlgorithms: config.loadBalancer.availableAlgorithms
        });
    }
});

app.post('/admin/servers', (req, res) => {
    const { url, weight } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'Server URL is required' });
    }
    
    ServerPool.addServer(url, weight || config.serverPool.defaultWeight);
    console.log(`[Admin] Added server: ${url} with weight: ${weight || 1}`);
    
    res.status(201).json({ 
        message: `Server ${url} added with weight ${weight || 1}`,
        server: url
    });
});

app.delete('/admin/servers', (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'Server URL is required' });
    }
    
    ServerPool.removeServer(url);
    console.log(`[Admin] Removed server: ${url}`);
    
    res.status(200).json({ 
        message: `Server ${url} removed`,
        server: url
    });
});

app.patch('/admin/servers', (req, res) => {
    const { url, weight } = req.body;
    
    if (!url || weight === undefined) {
        return res.status(400).json({ error: 'Server URL and weight are required' });
    }
    
    const server = ServerPool.servers.find(s => s.url === url);
    
    if (server) {
        const oldWeight = server.weight;
        server.weight = weight;
        console.log(`[Admin] Updated server ${url} weight: ${oldWeight} -> ${weight}`);
        
        res.status(200).json({ 
            message: `Server ${url} weight updated to ${weight}`,
            server: url,
            oldWeight,
            newWeight: weight
        });
    } else {
        res.status(404).json({ 
            error: 'Server not found',
            url
        });
    }
});

app.get('/admin/info', (req, res) => {
    res.json({
        name: 'Platefull Load Balancer',
        version: '1.0.0',
        port: PORT,
        config: {
            algorithm: ServerPool.algorithm,
            healthCheckInterval: config.serverPool.healthCheckInterval,
            availableAlgorithms: config.loadBalancer.availableAlgorithms
        }
    });
});

app.post('/admin/reset', (req, res) => {
    try {
        ServerPool.resetMetrics();
        res.status(200).json({ message: 'Metrics reset' });
    } catch (err) {
        console.error('[Admin] Failed to reset metrics:', err);
        res.status(500).json({ error: 'Failed to reset metrics' });
    }
});

app.get('/admin/analyze', (req, res) => {
    try {
        const analysis = ServerPool.analyzeAlgorithmPerformance();
        res.status(200).json(analysis);
    } catch (error) {
        console.error('[Admin] Error analyzing algorithms:', error);
        res.status(500).json({ error: error.message });
    }
});

const dynamicRouter = (req) => {
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     '0.0.0.0';
    
    const targetServer = ServerPool.getNextServer(clientIP);
    
    if (!targetServer) {
        console.error('[Proxy] ❌ No available servers!');
        return null;
    }
    
    ServerPool.incrementConnections(targetServer.url, clientIP);
    
    console.log(`[Proxy] 🔀 ${req.method} ${req.path} -> ${targetServer.url} (${targetServer.connections} conn) [${ServerPool.algorithm}] from ${clientIP}`);
    
    req._startTime = Date.now();
    req._targetUrl = targetServer.url;
    req._clientIP = clientIP;
    
    broadcastRequestEvent({
        type: 'request',
        timestamp: new Date().toISOString(),
        algorithm: ServerPool.algorithm,
        server: targetServer.url,
        method: req.method,
        path: req.path,
        clientIP: clientIP,
        connections: targetServer.connections,
        load: parseInt(req.query.load) || 0
    });
    
    return targetServer.url;
};

const proxyOptions = {
    router: dynamicRouter,
    changeOrigin: true,
    preserveHeaderKeyCase: true,
    timeout: config.proxy.timeout,
    
    onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('X-Load-Balancer', 'Platefull-LB');
        proxyReq.setHeader('X-LB-Algorithm', ServerPool.algorithm);
    },
    
    onProxyRes: (proxyRes, req, res) => {
        const targetUrl = `http://${proxyRes.req.host}:${proxyRes.req.port || 80}`;
        ServerPool.decrementConnections(targetUrl, req._clientIP);
        
        if (req._startTime && req._targetUrl) {
            const responseTime = Date.now() - req._startTime;
            const success = proxyRes.statusCode < 500;
            ServerPool.updateRequestMetrics(req._targetUrl, responseTime, success);
            
            ServerPool.updateAlgorithmMetrics(responseTime, success);
            
            res.setHeader('X-Served-By', req._targetUrl);
            res.setHeader('X-Response-Time', `${responseTime}ms`);
            res.setHeader('X-LB-Algorithm', ServerPool.algorithm);
            
            broadcastRequestEvent({
                type: 'response',
                timestamp: new Date().toISOString(),
                algorithm: ServerPool.algorithm,
                server: req._targetUrl,
                responseTime: responseTime,
                status: proxyRes.statusCode,
                success: success,
                path: req.path
            });
        }
    },
    
    onError: (err, req, res) => {
        console.error(`[Proxy] ❌ Error: ${err.message}`);
        
        if (req && req._targetUrl) {
            ServerPool.updateRequestMetrics(req._targetUrl, 0, false);
            ServerPool.updateAlgorithmMetrics(0, false);
            if (req._clientIP) {
                ServerPool.decrementConnections(req._targetUrl, req._clientIP);
            }
        }
        
        if (res && !res.headersSent) {
            res.status(503).json({
                success: false,
                error: 'Service Unavailable',
                message: 'All backend servers are currently unavailable. Please try again later.',
                timestamp: new Date().toISOString()
            });
        }
    },
    
    logLevel: 'warn'
};
const proxy = createProxyMiddleware(proxyOptions);
app.use('/', proxy);

app.listen(PORT, () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║       PLATEFULL LOAD BALANCER - READY                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🚀 Load Balancer:    http://localhost:${PORT}`);
    console.log(`📊 Admin API:        http://localhost:${PORT}/admin`);
    console.log(`📈 Dashboard:        http://localhost:${config.dashboard.port}`);
    console.log('');
    console.log(`⚙️  Algorithm:        ${ServerPool.algorithm}`);
    console.log(`🖥️  Backend Servers:  ${config.initialServers.length}`);
    console.log('');
    console.log('✅ System is ready to handle requests!');
    console.log('');
});

process.on('SIGINT', () => {
    console.log('');
    console.log('🛑 Shutting down load balancer...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('');
    console.log('🛑 Shutting down load balancer...');
    process.exit(0);
});
