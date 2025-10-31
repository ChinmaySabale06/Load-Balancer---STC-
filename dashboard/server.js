const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║       LOAD BALANCER DASHBOARD - STARTING UP               ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'dashboard',
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║       LOAD BALANCER DASHBOARD - READY                     ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`🌐 Dashboard URL:      http://localhost:${PORT}`);
    console.log(`📊 Load Balancer API:  http://localhost:8080/admin`);
    console.log('');
    console.log('✅ Dashboard is ready!');
    console.log('   Open http://localhost:3000 in your browser');
    console.log('');
});
