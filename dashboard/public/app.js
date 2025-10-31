const LOAD_BALANCER_URL = 'http://localhost:8080';
const UPDATE_INTERVAL = 2000;

let updateTimer = null;
let algorithmDescriptions = {};
let isConnected = false;
let eventSource = null;
let logPaused = false;
let autoScroll = true;
let logEntries = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Load Balancer Dashboard initialized');

    loadAlgorithms();
    loadMetrics();

    setupEventListeners();
    setupLiveLog();

    startAutoRefresh();
});

function setupEventListeners() {
    document.getElementById('algorithm-select').addEventListener('change', changeAlgorithm);

    document.getElementById('send-request-btn').addEventListener('click', () => sendTestRequests(1));
    document.getElementById('send-10-requests-btn').addEventListener('click', () => sendTestRequests(10));
    document.getElementById('send-50-requests-btn').addEventListener('click', () => sendTestRequests(50));
    document.getElementById('send-custom-btn').addEventListener('click', sendCustomRequests);
    document.getElementById('send-individual-btn').addEventListener('click', sendIndividualRequests);
    document.getElementById('clear-results-btn').addEventListener('click', clearTestResults);

    document.getElementById('mode-uniform-btn').addEventListener('click', () => switchMode('uniform'));
    document.getElementById('mode-individual-btn').addEventListener('click', () => switchMode('individual'));
    
    document.getElementById('generate-inputs-btn').addEventListener('click', generateIndividualInputs);
    document.getElementById('preset-zero-btn').addEventListener('click', () => fillPreset('zero'));
    document.getElementById('preset-equal-btn').addEventListener('click', () => fillPreset('equal'));
    document.getElementById('preset-random-btn').addEventListener('click', () => fillPreset('random'));
    document.getElementById('preset-increasing-btn').addEventListener('click', () => fillPreset('increasing'));

    document.getElementById('refresh-viz-btn').addEventListener('click', updateVisualization);
    
    document.getElementById('clear-log-btn').addEventListener('click', clearLog);
    document.getElementById('pause-log-btn').addEventListener('click', togglePauseLog);
    document.getElementById('auto-scroll-toggle').addEventListener('change', (e) => {
        autoScroll = e.target.checked;
    });
}

function switchMode(mode) {
    const uniformBtn = document.getElementById('mode-uniform-btn');
    const individualBtn = document.getElementById('mode-individual-btn');
    const uniformMode = document.getElementById('uniform-mode');
    const individualMode = document.getElementById('individual-mode');
    
    if (mode === 'uniform') {
        uniformBtn.classList.add('active');
        individualBtn.classList.remove('active');
        uniformMode.style.display = 'block';
        individualMode.style.display = 'none';
    } else {
        uniformBtn.classList.remove('active');
        individualBtn.classList.add('active');
        uniformMode.style.display = 'none';
        individualMode.style.display = 'block';
    }
}

function generateIndividualInputs() {
    const count = parseInt(document.getElementById('individual-count').value) || 10;
    
    if (count < 1 || count > 50) {
        showNotification('Please enter a count between 1 and 50', 'error');
        return;
    }
    
    const container = document.getElementById('individual-inputs-container');
    container.innerHTML = '';
    
    for (let i = 1; i <= count; i++) {
        const row = document.createElement('div');
        row.className = 'request-input-row';
        row.innerHTML = `
            <span class="request-label">Request ${i}:</span>
            <input type="number" 
                   id="load-${i}" 
                   class="request-load-input" 
                   min="0" 
                   max="5000" 
                   value="0"
                   placeholder="Load in ms">
            <span class="request-unit">ms</span>
        `;
        container.appendChild(row);
    }
    
    showNotification(`Generated ${count} input fields`, 'success');
}

function fillPreset(preset) {
    const container = document.getElementById('individual-inputs-container');
    const inputs = container.querySelectorAll('.request-load-input');
    
    if (inputs.length === 0) {
        showNotification('Generate inputs first', 'error');
        return;
    }
    
    inputs.forEach((input, index) => {
        switch(preset) {
            case 'zero':
                input.value = 0;
                break;
            case 'equal':
                input.value = 500;
                break;
            case 'random':
                input.value = Math.floor(Math.random() * 1000);
                break;
            case 'increasing':
                input.value = (index + 1) * 100;
                break;
        }
    });
    
    showNotification(`Applied ${preset} preset`, 'success');
}

async function sendIndividualRequests() {
    const container = document.getElementById('individual-inputs-container');
    const inputs = container.querySelectorAll('.request-load-input');
    
    if (inputs.length === 0) {
        showNotification('Generate inputs first', 'error');
        return;
    }
    
    const concurrent = document.getElementById('individual-concurrent').checked;
    const loadValues = Array.from(inputs).map(input => parseInt(input.value) || 0);
    const count = loadValues.length;
    
    const resultDiv = document.getElementById('test-result');
    resultDiv.innerHTML = `<div class="test-loading">Sending ${count} individual request(s) ${concurrent ? 'concurrently' : 'sequentially'}...<br>Load pattern: [${loadValues.join(', ')}] ms</div>`;
    
    const startTime = Date.now();
    const results = [];
    
    try {
        if (concurrent) {
            const promises = loadValues.map(loadMs =>
                fetch(`${LOAD_BALANCER_URL}/api/health?delay=${loadMs}`)
                    .then(res => res.json())
                    .then(data => ({
                        success: true,
                        server: data.server || 'unknown',
                        load: loadMs,
                        status: 200
                    }))
                    .catch(err => ({
                        success: false,
                        error: err.message,
                        load: loadMs
                    }))
            );
            const responses = await Promise.all(promises);
            results.push(...responses);
        } else {
            for (let i = 0; i < loadValues.length; i++) {
                const loadMs = loadValues[i];
                try {
                    const res = await fetch(`${LOAD_BALANCER_URL}/api/health?delay=${loadMs}`);
                    const data = await res.json();
                    results.push({
                        success: true,
                        server: data.server || 'unknown',
                        load: loadMs,
                        status: 200
                    });
                } catch (err) {
                    results.push({
                        success: false,
                        error: err.message,
                        load: loadMs
                    });
                }
            }
        }
        
        const totalTime = Date.now() - startTime;
        
        const serverCount = {};
        results.forEach(r => {
            if (r.success) {
                const server = r.server || 'unknown';
                serverCount[server] = (serverCount[server] || 0) + 1;
            }
        });
        
        const avgLoad = loadValues.reduce((a, b) => a + b, 0) / loadValues.length;
        const maxLoad = Math.max(...loadValues);
        const minLoad = Math.min(...loadValues);
        
        let html = `
            <div class="test-success">
                <h4>✅ Individual Requests Complete</h4>
                <p><strong>Requests Sent:</strong> ${count}</p>
                <p><strong>Load Pattern:</strong> Min: ${minLoad}ms, Max: ${maxLoad}ms, Avg: ${avgLoad.toFixed(1)}ms</p>
                <p><strong>Mode:</strong> ${concurrent ? 'Concurrent' : 'Sequential'}</p>
                <p><strong>Total Time:</strong> ${totalTime}ms</p>
                <p><strong>Avg Time per Request:</strong> ${(totalTime / count).toFixed(2)}ms</p>
                <h5>Distribution Across Servers:</h5>
                <ul class="distribution-list">
        `;
        
        Object.entries(serverCount).forEach(([server, count]) => {
            const percentage = (count / results.length * 100).toFixed(1);
            html += `<li><strong>${server}:</strong> ${count} requests (${percentage}%)</li>`;
        });
        
        html += `</ul>
                <details style="margin-top: 1rem;">
                    <summary style="cursor: pointer; color: var(--primary-color);">View Individual Request Details</summary>
                    <div style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto;">
        `;
        
        results.forEach((r, i) => {
            const status = r.success ? '✅' : '❌';
            html += `<div style="padding: 0.25rem; font-size: 0.85rem;">${status} Request ${i+1}: ${r.load}ms load → ${r.server || 'Failed'}</div>`;
        });
        
        html += `</div></details></div>`;
        resultDiv.innerHTML = html;
        
        setTimeout(() => {
            loadMetrics();
            updateVisualization();
        }, 500);
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="test-error">
                <h4>❌ Test Failed</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
}

async function loadAlgorithms() {
    try {
        const response = await fetch(`${LOAD_BALANCER_URL}/admin/algorithm`);
        const data = await response.json();
        
        algorithmDescriptions = data.descriptions || {};
        
        document.getElementById('current-algorithm').textContent = data.algorithm;
        
        const select = document.getElementById('algorithm-select');
        select.innerHTML = '<option value="">Select Algorithm...</option>';
        
        data.availableAlgorithms.forEach(algo => {
            const option = document.createElement('option');
            option.value = algo;
            option.textContent = algo.replace(/_/g, ' ');
            if (algo === data.algorithm) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        showAlgorithmDescription(data.algorithm);
        
        updateConnectionStatus(true);
    } catch (error) {
        console.error('Failed to load algorithms:', error);
        updateConnectionStatus(false);
    }
}

async function changeAlgorithm(event) {
    const algorithm = event.target.value;
    
    if (!algorithm) return;
    
    try {
        const response = await fetch(`${LOAD_BALANCER_URL}/admin/algorithm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ algorithm })
        });
        
        if (response.ok) {
            const data = await response.json();
            document.getElementById('current-algorithm').textContent = data.algorithm;
            showAlgorithmDescription(data.algorithm);
            showNotification(`Algorithm changed to ${algorithm}`, 'success');
            
            loadMetrics();
        } else {
            showNotification('Failed to change algorithm', 'error');
        }
    } catch (error) {
        console.error('Failed to change algorithm:', error);
        showNotification('Error changing algorithm', 'error');
    }
}

async function loadMetrics() {
    try {
        const response = await fetch(`${LOAD_BALANCER_URL}/admin/metrics`);
        const data = await response.json();
        
        document.getElementById('metric-total-requests').textContent = data.totalRequests.toLocaleString();
        document.getElementById('metric-avg-response').textContent = `${data.avgResponseTime}ms`;
        document.getElementById('metric-healthy-servers').textContent = `${data.healthyServers}/${data.totalServers}`;
        document.getElementById('metric-connections').textContent = data.totalConnections.toLocaleString();
        document.getElementById('metric-unique-clients').textContent = data.uniqueClients.toLocaleString();
        document.getElementById('metric-uptime').textContent = data.uptime;
        
        updateServerPool(data.servers);
        
        updateVisualization();
        
        updateConnectionStatus(true);
    } catch (error) {
        console.error('Failed to load metrics:', error);
        updateConnectionStatus(false);
    }
}

function updateServerPool(servers) {
    const container = document.getElementById('server-pool-container');
    container.innerHTML = '';
    
    servers.forEach(server => {
        const serverCard = document.createElement('div');
        serverCard.className = `server-card status-${server.status.toLowerCase()}`;
        
        serverCard.innerHTML = `
            <div class="server-header">
                <div class="server-url">${server.url}</div>
                <div class="server-status status-${server.status.toLowerCase()}">${server.status}</div>
            </div>
            <div class="server-stats">
                <div class="stat">
                    <span class="stat-label">Connections:</span>
                    <span class="stat-value">${server.connections}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Weight:</span>
                    <span class="stat-value">${server.weight}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Total Requests:</span>
                    <span class="stat-value">${server.totalRequests.toLocaleString()}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Success Rate:</span>
                    <span class="stat-value">${server.uptime}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Avg Response:</span>
                    <span class="stat-value">${server.avgResponseTime}ms</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Failed:</span>
                    <span class="stat-value">${server.failedRequests}</span>
                </div>
            </div>
            <div class="server-clients">
                <div class="clients-header">
                    <span>Connected Clients: ${server.clients.length}</span>
                </div>
                <div class="clients-list">
                    ${server.clients.length > 0 
                        ? server.clients.slice(0, 5).map(c => `<span class="client-ip">${formatIP(c)}</span>`).join('')
                        : '<span class="no-clients">No active clients</span>'
                    }
                    ${server.clients.length > 5 
                        ? `<span class="client-ip">+${server.clients.length - 5} more</span>`
                        : ''
                    }
                </div>
            </div>
        `;
        
        container.appendChild(serverCard);
    });
}

function showAlgorithmDescription(algorithm) {
    const descElement = document.getElementById('algorithm-description');
    const description = algorithmDescriptions[algorithm] || 'No description available';
    descElement.innerHTML = `<p><strong>Description:</strong> ${description}</p>`;
}

function updateConnectionStatus(connected) {
    isConnected = connected;
    const statusEl = document.getElementById('connection-status');
    const dotEl = statusEl.querySelector('.status-dot');
    const textEl = statusEl.querySelector('.status-text');
    
    if (connected) {
        statusEl.className = 'status-indicator connected';
        textEl.textContent = 'Connected';
    } else {
        statusEl.className = 'status-indicator disconnected';
        textEl.textContent = 'Disconnected';
    }
}

async function sendCustomRequests() {
    const count = parseInt(document.getElementById('custom-request-count').value) || 1;
    const loadMs = parseInt(document.getElementById('request-load').value) || 0;
    const concurrent = document.getElementById('concurrent-requests').checked;
    
    if (count < 1 || count > 1000) {
        showNotification('Please enter a count between 1 and 1000', 'error');
        return;
    }
    
    const resultDiv = document.getElementById('test-result');
    resultDiv.innerHTML = `<div class="test-loading">Sending ${count} custom request(s) with ${loadMs}ms load ${concurrent ? 'concurrently' : 'sequentially'}...</div>`;
    
    const startTime = Date.now();
    const results = [];
    
    try {
        if (concurrent) {
            const promises = [];
            for (let i = 0; i < count; i++) {
                promises.push(
                    fetch(`${LOAD_BALANCER_URL}/api/health?delay=${loadMs}`)
                        .then(res => res.json())
                        .then(data => ({
                            success: true,
                            server: data.server || 'unknown',
                            status: 200
                        }))
                        .catch(err => ({
                            success: false,
                            error: err.message
                        }))
                );
            }
            const responses = await Promise.all(promises);
            results.push(...responses);
        } else {
            for (let i = 0; i < count; i++) {
                try {
                    const res = await fetch(`${LOAD_BALANCER_URL}/api/health?delay=${loadMs}`);
                    const data = await res.json();
                    results.push({
                        success: true,
                        server: data.server || 'unknown',
                        status: 200
                    });
                } catch (err) {
                    results.push({
                        success: false,
                        error: err.message
                    });
                }
            }
        }
        
        const totalTime = Date.now() - startTime;
        
        const serverCount = {};
        results.forEach(r => {
            if (r.success) {
                const server = r.server || 'unknown';
                serverCount[server] = (serverCount[server] || 0) + 1;
            }
        });
        
        let html = `
            <div class="test-success">
                <h4>✅ Custom Test Complete</h4>
                <p><strong>Requests Sent:</strong> ${count}</p>
                <p><strong>Simulated Load:</strong> ${loadMs}ms per request</p>
                <p><strong>Mode:</strong> ${concurrent ? 'Concurrent' : 'Sequential'}</p>
                <p><strong>Total Time:</strong> ${totalTime}ms</p>
                <p><strong>Avg Time per Request:</strong> ${(totalTime / count).toFixed(2)}ms</p>
                <h5>Distribution Across Servers:</h5>
                <ul class="distribution-list">
        `;
        
        Object.entries(serverCount).forEach(([server, count]) => {
            const percentage = (count / results.length * 100).toFixed(1);
            html += `<li><strong>${server}:</strong> ${count} requests (${percentage}%)</li>`;
        });
        
        html += `</ul></div>`;
        resultDiv.innerHTML = html;
        
        setTimeout(() => {
            loadMetrics();
            updateVisualization();
        }, 500);
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="test-error">
                <h4>❌ Test Failed</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
}

async function sendTestRequests(count) {
    const resultDiv = document.getElementById('test-result');
    resultDiv.innerHTML = `<div class="test-loading">Sending ${count} request(s)...</div>`;
    
    const startTime = Date.now();
    const results = [];
    
    try {
        const promises = [];
        for (let i = 0; i < count; i++) {
            promises.push(
                fetch(`${LOAD_BALANCER_URL}/api/health`)
                    .then(res => res.json())
                    .then(data => ({
                        success: true,
                        server: data.server || 'unknown',
                        status: 200
                    }))
                    .catch(err => ({
                        success: false,
                        error: err.message
                    }))
            );
        }
        
        const responses = await Promise.all(promises);
        const totalTime = Date.now() - startTime;
        
        const serverCount = {};
        responses.forEach(r => {
            if (r.success) {
                const server = r.server || 'unknown';
                serverCount[server] = (serverCount[server] || 0) + 1;
            }
        });
        
        let html = `
            <div class="test-success">
                <h4>✅ Test Complete</h4>
                <p><strong>Requests Sent:</strong> ${count}</p>
                <p><strong>Total Time:</strong> ${totalTime}ms</p>
                <p><strong>Avg Time per Request:</strong> ${(totalTime / count).toFixed(2)}ms</p>
                <h5>Distribution Across Servers:</h5>
                <ul class="distribution-list">
        `;
        
        Object.entries(serverCount).forEach(([server, count]) => {
            const percentage = (count / responses.length * 100).toFixed(1);
            html += `<li><strong>${server}:</strong> ${count} requests (${percentage}%)</li>`;
        });
        
        html += `</ul></div>`;
        resultDiv.innerHTML = html;
        
        setTimeout(() => {
            loadMetrics();
            updateVisualization();
        }, 500);
        
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="test-error">
                <h4>❌ Test Failed</h4>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function updateVisualization() {
    fetch(`${LOAD_BALANCER_URL}/admin/metrics`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('viz-algorithm-name').textContent = data.algorithm;
            
            const container = document.getElementById('visualization-container');
            
            if (data.totalRequests === 0) {
                container.innerHTML = `
                    <div class="visualization-placeholder">
                        <div class="placeholder-icon">📈</div>
                        <p>Send test requests to see the distribution pattern</p>
                    </div>
                `;
                return;
            }
            
            const maxRequests = Math.max(...data.servers.map(s => s.totalRequests));
            
            let html = '<div class="viz-chart">';
            
            data.servers.forEach((server, index) => {
                const percentage = maxRequests > 0 ? (server.totalRequests / maxRequests * 100) : 0;
                const requestPercentage = data.totalRequests > 0 ? (server.totalRequests / data.totalRequests * 100).toFixed(1) : 0;
                
                html += `
                    <div class="viz-server-row">
                        <div class="viz-server-label">${server.url}</div>
                        <div class="viz-bar-wrapper">
                            <div class="viz-bar-background">
                                <div class="viz-bar server-${index}" style="width: ${percentage}%">
                                    ${server.totalRequests}
                                </div>
                            </div>
                        </div>
                        <div class="viz-stats">
                            <div class="viz-stat">
                                <span class="viz-stat-label">Requests</span>
                                <span class="viz-stat-value">${server.totalRequests}</span>
                            </div>
                            <div class="viz-stat">
                                <span class="viz-stat-label">Share</span>
                                <span class="viz-stat-value">${requestPercentage}%</span>
                            </div>
                            <div class="viz-stat">
                                <span class="viz-stat-label">Avg Time</span>
                                <span class="viz-stat-value">${server.avgResponseTime}ms</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
            
            html += `
                <div class="viz-summary">
                    <div class="viz-summary-item">
                        <div class="viz-summary-label">Total Requests</div>
                        <div class="viz-summary-value">${data.totalRequests}</div>
                    </div>
                    <div class="viz-summary-item">
                        <div class="viz-summary-label">Algorithm</div>
                        <div class="viz-summary-value" style="font-size: 1rem;">${data.algorithm.replace(/_/g, ' ')}</div>
                    </div>
                    <div class="viz-summary-item">
                        <div class="viz-summary-label">Avg Response</div>
                        <div class="viz-summary-value">${data.avgResponseTime}ms</div>
                    </div>
                    <div class="viz-summary-item">
                        <div class="viz-summary-label">Active Servers</div>
                        <div class="viz-summary-value">${data.healthyServers}/${data.totalServers}</div>
                    </div>
                </div>
            `;
            
            container.innerHTML = html;
        })
        .catch(error => {
            console.error('Failed to update visualization:', error);
        });
}

function clearTestResults() {
    document.getElementById('test-result').innerHTML = '';

    (async () => {
        try {
            const resp = await fetch(`${LOAD_BALANCER_URL}/admin/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (resp.ok) {
                showNotification('Metrics reset successfully', 'success');
                setTimeout(() => {
                    loadMetrics();
                    updateVisualization();
                }, 300);
            } else {
                showNotification('Failed to reset metrics', 'error');
            }
        } catch (err) {
            console.error('Error resetting metrics:', err);
            showNotification('Error resetting metrics', 'error');
        }
    })();
}

function formatIP(ip) {
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    return ip;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function startAutoRefresh() {
    if (updateTimer) {
        clearInterval(updateTimer);
    }
    
    updateTimer = setInterval(() => {
        loadMetrics();
    }, UPDATE_INTERVAL);
    
    console.log(`✅ Auto-refresh started (every ${UPDATE_INTERVAL / 1000}s)`);
}

function stopAutoRefresh() {
    if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
        console.log('⏸️ Auto-refresh stopped');
    }
}

// Handle visibility change to pause/resume updates
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        startAutoRefresh();
        loadMetrics(); // Immediate refresh when page becomes visible
    }
});

function formatAlgorithmName(algorithm) {
    return algorithm.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function setupLiveLog() {
    console.log('📡 Setting up live request log...');
    
    eventSource = new EventSource(`${LOAD_BALANCER_URL}/admin/events`);
    
    eventSource.onopen = () => {
        console.log('✅ SSE connection established');
        removePlaceholder();
    };
    
    eventSource.onmessage = (event) => {
        if (logPaused) return;
        
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'connected') {
                console.log('📡 Connected to load balancer event stream');
                return;
            }
            
            if (data.type === 'request') {
                addLogEntry(data);
            } else if (data.type === 'response') {
                updateLogEntry(data);
            }
        } catch (error) {
            console.error('Error parsing SSE data:', error);
        }
    };
    
    eventSource.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        if (eventSource.readyState === EventSource.CLOSED) {
            console.log('🔄 SSE connection closed, attempting to reconnect...');
            setTimeout(setupLiveLog, 5000);
        }
    };
}

function addLogEntry(data) {
    const container = document.getElementById('live-log-container');
    
    removePlaceholder();
    
    const entry = document.createElement('div');
    entry.className = 'log-entry new-entry';
    entry.dataset.timestamp = data.timestamp;
    entry.dataset.server = data.server;
    
    const time = new Date(data.timestamp);
    const timeStr = time.toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        fractionalSecondDigits: 3
    });
    
    // Extract port number from URL (e.g., "http://localhost:5001" -> "5001")
    const serverMatch = data.server.match(/:(\d+)/);
    const serverPort = serverMatch ? serverMatch[1] : data.server.split(':').pop();
    const loadText = data.load > 0 ? ` (${data.load}ms load)` : '';
    
    entry.innerHTML = `
        <span class="log-timestamp">${timeStr}</span>
        <div class="log-details">
            <span class="log-algorithm">${data.algorithm}</span>
            <span class="log-arrow">→</span>
            <span class="log-server">Server ${serverPort}</span>
            <span class="log-status processing">⏳ Processing</span>
            ${loadText ? `<span class="log-load">${loadText}</span>` : ''}
        </div>
    `;
    
    // Append to bottom to maintain request order
    container.appendChild(entry);
    
    setTimeout(() => entry.classList.remove('new-entry'), 300);
    
    logEntries.push({ timestamp: data.timestamp, element: entry });
    
    if (logEntries.length > 500) {
        const removed = logEntries.shift();
        if (removed.element.parentNode) {
            removed.element.remove();
        }
    }
    
    if (autoScroll) {
        container.scrollTop = container.scrollHeight;
    }
    
    updateAlgorithmName(data.algorithm);
}

function updateLogEntry(data) {
    const entries = document.querySelectorAll('.log-entry');
    
    for (const entry of entries) {
        if (entry.dataset.server === data.server) {
            const statusEl = entry.querySelector('.log-status');
            if (statusEl && statusEl.textContent.includes('Processing')) {
                if (data.success) {
                    statusEl.className = 'log-status success';
                    statusEl.textContent = `✓ ${data.responseTime}ms`;
                } else {
                    statusEl.className = 'log-status error';
                    statusEl.textContent = `✗ Error`;
                }
                break;
            }
        }
    }
}

function removePlaceholder() {
    const container = document.getElementById('live-log-container');
    const placeholder = container.querySelector('.log-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
}

function clearLog() {
    const container = document.getElementById('live-log-container');
    container.innerHTML = `
        <div class="log-placeholder">
            <div class="placeholder-icon">📝</div>
            <p>Log cleared. Waiting for new requests...</p>
        </div>
    `;
    logEntries = [];
}

function togglePauseLog() {
    const btn = document.getElementById('pause-log-btn');
    const container = document.getElementById('live-log-container');
    
    logPaused = !logPaused;
    
    if (logPaused) {
        btn.textContent = '▶️ Resume';
        btn.style.background = 'var(--warning-color)';
        
        const indicator = document.createElement('div');
        indicator.className = 'log-paused-indicator';
        indicator.textContent = '⏸️ LOG PAUSED';
        indicator.id = 'paused-indicator';
        container.appendChild(indicator);
    } else {
        btn.textContent = '⏸️ Pause';
        btn.style.background = '';
        
        const indicator = document.getElementById('paused-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
}

function updateAlgorithmName(algorithm) {
    const element = document.getElementById('log-algorithm-name');
    if (element) {
        element.textContent = algorithm;
    }
}
