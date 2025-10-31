const axios = require('axios');
const config = require('./config');

class ServerPool {
    constructor() {
        this.servers = [];
        this.healthCheckInterval = config.serverPool.healthCheckInterval;
        this.healthCheckPath = config.serverPool.healthCheckPath;
        this.algorithm = config.loadBalancer.defaultAlgorithm;
        this.roundRobinIndex = 0;
        this.weightedRoundRobinIndex = 0;
        this.requestCount = 0;
        this.totalResponseTime = 0;
        this.startTime = Date.now();
        
        this.clientConnections = new Map();
        
        this.algorithmMetrics = new Map();
        this.initializeAlgorithmMetrics();
    }

    initializeAlgorithmMetrics() {
        const algorithms = [
            'ROUND_ROBIN',
            'WEIGHTED_ROUND_ROBIN',
            'LEAST_CONNECTIONS',
            'RANDOM',
            'LEAST_RESPONSE_TIME'
        ];
        
        algorithms.forEach(algo => {
            this.algorithmMetrics.set(algo, {
                totalRequests: 0,
                totalResponseTime: 0,
                avgResponseTime: 0,
                failedRequests: 0,
                successfulRequests: 0,
                loadDistributionScore: 0,
                lastUsed: null
            });
        });
    }

    addServer(url, weight = 1) {
        if (!this.servers.find(s => s.url === url)) {
            const server = { 
                url: url, 
                status: 'UNKNOWN', 
                connections: 0,
                weight: weight,
                currentWeight: 0,
                totalRequests: 0,
                totalResponseTime: 0,
                avgResponseTime: 0,
                failedRequests: 0,
                successfulRequests: 0,
                lastHealthCheck: null,
                clients: []
            };
            this.servers.push(server);
            console.log(`[Pool] Added server: ${url} with weight: ${weight}`);
            this.checkServerHealth(server);
            return server;
        }
    }

    removeServer(url) {
        this.servers = this.servers.filter(s => s.url !== url);
        console.log(`[Pool] Removed server: ${url}`);
    }

    setAlgorithm(algorithm) {
        const validAlgorithms = config.loadBalancer.availableAlgorithms;
        
        if (validAlgorithms.includes(algorithm)) {
            this.algorithm = algorithm;
            console.log(`[Pool] Algorithm changed to: ${algorithm}`);
            return true;
        }
        console.error(`[Pool] Invalid algorithm: ${algorithm}`);
        return false;
    }

    getRoundRobinServer() {
        const availableServers = this.servers.filter(s => s.status === 'UP');
        
        if (availableServers.length === 0) return null;

        const server = availableServers[this.roundRobinIndex % availableServers.length];
        this.roundRobinIndex++;
        return server;
    }

    getWeightedRoundRobinServer() {
        const availableServers = this.servers.filter(s => s.status === 'UP');
        
        if (availableServers.length === 0) return null;

        let totalWeight = 0;
        let maxWeight = 0;
        
        for (const server of availableServers) {
            totalWeight += server.weight;
            if (server.weight > maxWeight) {
                maxWeight = server.weight;
            }
        }
        while (true) {
            this.weightedRoundRobinIndex = (this.weightedRoundRobinIndex + 1) % availableServers.length;
            const server = availableServers[this.weightedRoundRobinIndex];
            
            server.currentWeight += server.weight;
            
            if (server.currentWeight >= maxWeight) {
                server.currentWeight -= totalWeight;
                return server;
            }
        }
    }

    getLeastConnectionsServer() {
        const availableServers = this.servers.filter(s => s.status === 'UP');
        
        if (availableServers.length === 0) return null;

        let minConnections = Infinity;
        let selectedServer = null;

        for (const server of availableServers) {
            if (server.connections < minConnections) {
                minConnections = server.connections;
                selectedServer = server;
            }
        }
        return selectedServer;
    }

    getRandomServer() {
        const availableServers = this.servers.filter(s => s.status === 'UP');
        
        if (availableServers.length === 0) return null;

        const randomIndex = Math.floor(Math.random() * availableServers.length);
        return availableServers[randomIndex];
    }

    getLeastResponseTimeServer() {
        const availableServers = this.servers.filter(s => s.status === 'UP');
        
        if (availableServers.length === 0) return null;

        let minResponseTime = Infinity;
        let selectedServer = null;

        for (const server of availableServers) {
            const responseTime = server.avgResponseTime || 0;
            const adjustedTime = responseTime * (server.connections + 1);
            
            if (adjustedTime < minResponseTime || (adjustedTime === 0 && minResponseTime === Infinity)) {
                minResponseTime = adjustedTime;
                selectedServer = server;
            }
        }

        if (minResponseTime === 0 || minResponseTime === Infinity) {
            return this.getLeastConnectionsServer();
        }
        
        return selectedServer;
    }

    getNextServer(clientIP = null) {
        let server = null;

        switch (this.algorithm) {
            case 'ROUND_ROBIN':
                server = this.getRoundRobinServer();
                break;
            case 'WEIGHTED_ROUND_ROBIN':
                server = this.getWeightedRoundRobinServer();
                break;
            case 'LEAST_CONNECTIONS':
                server = this.getLeastConnectionsServer();
                break;
            case 'RANDOM':
                server = this.getRandomServer();
                break;
            case 'LEAST_RESPONSE_TIME':
                server = this.getLeastResponseTimeServer();
                break;
            default:
                console.warn(`[Pool] Unknown algorithm: ${this.algorithm}, using LEAST_CONNECTIONS`);
                server = this.getLeastConnectionsServer();
        }

        return server;
    }

    async checkServerHealth(server) {
        try {
            const startTime = Date.now();
            const response = await axios.get(`${server.url}${this.healthCheckPath}`, { 
                timeout: config.serverPool.healthCheckTimeout 
            });
            const responseTime = Date.now() - startTime;
            
            server.lastHealthCheck = new Date();
            
            if (server.status !== 'UP') {
                server.status = 'UP';
                console.log(`[Health] ✅ Server ${server.url} is UP. Response: ${responseTime}ms`);
            }
        } catch (error) {
            if (server.status !== 'DOWN') {
                server.status = 'DOWN';
                console.error(`[Health] ❌ Server ${server.url} is DOWN. Error: ${error.message}`);
            }
            server.lastHealthCheck = new Date();
        }
    }

    startHealthChecks() {
        console.log('[Health] Starting health check loop...');
        console.log(`[Health] Checking every ${this.healthCheckInterval / 1000} seconds`);
        
        setInterval(() => {
            if (this.servers.length > 0) {
                this.servers.forEach(server => this.checkServerHealth(server));
            }
        }, this.healthCheckInterval);
    }
    
    incrementConnections(url, clientIP = null) {
        const server = this.servers.find(s => s.url === url);
        if (server) {
            server.connections++;
            
            if (clientIP && !server.clients.includes(clientIP)) {
                server.clients.push(clientIP);
            }
            
            if (clientIP) {
                this.clientConnections.set(clientIP, url);
            }
        }
    }
    
    decrementConnections(url, clientIP = null) {
        const server = this.servers.find(s => s.url === url);
        if (server && server.connections > 0) {
            server.connections--;
            
            if (clientIP && server.connections === 0) {
                server.clients = server.clients.filter(c => c !== clientIP);
                this.clientConnections.delete(clientIP);
            }
        }
    }

    updateRequestMetrics(url, responseTime, success = true) {
        const server = this.servers.find(s => s.url === url);
        if (server) {
            server.totalRequests++;
            if (success) {
                server.successfulRequests++;
                server.totalResponseTime += responseTime;
                server.avgResponseTime = server.totalResponseTime / server.successfulRequests;
            } else {
                server.failedRequests++;
            }
        }
        
        this.requestCount++;
        if (success) {
            this.totalResponseTime += responseTime;
        }
    }

    resetMetrics() {
        this.requestCount = 0;
        this.totalResponseTime = 0;
        this.startTime = Date.now();

        this.clientConnections.clear();

        this.servers.forEach(server => {
            server.connections = 0;
            server.totalRequests = 0;
            server.successfulRequests = 0;
            server.failedRequests = 0;
            server.totalResponseTime = 0;
            server.avgResponseTime = 0;
            server.clients = [];
            server.currentWeight = 0;
            server.lastHealthCheck = server.lastHealthCheck;
        });

        console.log('[Pool] Metrics and client distribution have been reset');
    }

    getMetrics() {
        const uptime = Date.now() - this.startTime;
        const uptimeMinutes = Math.floor(uptime / 60000);
        const uptimeSeconds = Math.floor((uptime % 60000) / 1000);

        return {
            algorithm: this.algorithm,
            totalRequests: this.requestCount,
            avgResponseTime: this.requestCount > 0 
                ? (this.totalResponseTime / this.requestCount).toFixed(2) 
                : 0,
            uptime: `${uptimeMinutes}m ${uptimeSeconds}s`,
            totalServers: this.servers.length,
            healthyServers: this.servers.filter(s => s.status === 'UP').length,
            totalConnections: this.servers.reduce((sum, s) => sum + s.connections, 0),
            uniqueClients: this.clientConnections.size,
            servers: this.servers.map(s => ({
                url: s.url,
                status: s.status,
                connections: s.connections,
                weight: s.weight,
                totalRequests: s.totalRequests,
                successfulRequests: s.successfulRequests,
                failedRequests: s.failedRequests,
                avgResponseTime: s.avgResponseTime ? s.avgResponseTime.toFixed(2) : '0',
                uptime: s.status === 'UP' 
                    ? ((s.successfulRequests / (s.totalRequests || 1)) * 100).toFixed(2) + '%' 
                    : '0%',
                lastHealthCheck: s.lastHealthCheck,
                clients: s.clients
            }))
        };
    }

    getClientDistribution() {
        const distribution = {};
        
        this.servers.forEach(server => {
            distribution[server.url] = {
                connections: server.connections,
                clients: server.clients,
                clientCount: server.clients.length
            };
        });
        
        return distribution;
    }

    updateAlgorithmMetrics(responseTime, success = true) {
        const metrics = this.algorithmMetrics.get(this.algorithm);
        if (metrics) {
            metrics.totalRequests++;
            metrics.totalResponseTime += responseTime;
            metrics.avgResponseTime = metrics.totalResponseTime / metrics.totalRequests;
            metrics.lastUsed = new Date();
            
            if (success) {
                metrics.successfulRequests++;
            } else {
                metrics.failedRequests++;
            }
            metrics.loadDistributionScore = this.calculateLoadDistributionScore();
        }
    }

    calculateLoadDistributionScore() {
        if (this.servers.length === 0) return 0;

        const activeServers = this.servers.filter(s => s.status === 'UP');
        if (activeServers.length === 0) return 0;

        const totalLoad = activeServers.reduce((sum, s) => sum + s.totalRequests, 0);
        if (totalLoad === 0) return 100;

        const idealLoad = totalLoad / activeServers.length;

        const variance = activeServers.reduce((sum, s) => {
            const diff = s.totalRequests - idealLoad;
            return sum + (diff * diff);
        }, 0) / activeServers.length;

        const maxVariance = idealLoad * idealLoad;
        const score = Math.max(0, 100 - (variance / maxVariance) * 100);

        return Math.round(score);
    }

    analyzeAlgorithmPerformance() {
        const analysis = {
            currentAlgorithm: this.algorithm,
            recommendations: [],
            algorithmComparison: [],
            summary: {}
        };

        const currentMetrics = this.algorithmMetrics.get(this.algorithm);

        const algorithmScores = [];
        
        this.algorithmMetrics.forEach((metrics, algorithm) => {
            if (metrics.totalRequests === 0 && algorithm !== this.algorithm) {
                return;
            }

            const responseScore = metrics.avgResponseTime > 0 
                ? Math.max(0, 100 - (metrics.avgResponseTime / 10))
                : 50;
            
            const reliabilityScore = metrics.totalRequests > 0
                ? (metrics.successfulRequests / metrics.totalRequests) * 100
                : 50;

            const distributionScore = metrics.loadDistributionScore;

            const compositeScore = (
                responseScore * 0.4 + 
                reliabilityScore * 0.3 + 
                distributionScore * 0.3
            );

            algorithmScores.push({
                algorithm,
                metrics: {
                    totalRequests: metrics.totalRequests,
                    avgResponseTime: metrics.avgResponseTime.toFixed(2),
                    successRate: ((metrics.successfulRequests / (metrics.totalRequests || 1)) * 100).toFixed(1),
                    distributionScore: metrics.loadDistributionScore,
                    lastUsed: metrics.lastUsed
                },
                scores: {
                    response: Math.round(responseScore),
                    reliability: Math.round(reliabilityScore),
                    distribution: distributionScore,
                    composite: Math.round(compositeScore)
                },
                compositeScore
            });
        });

        algorithmScores.sort((a, b) => b.compositeScore - a.compositeScore);

        analysis.algorithmComparison = algorithmScores;

        if (algorithmScores.length > 1) {
            const best = algorithmScores[0];
            const current = algorithmScores.find(a => a.algorithm === this.algorithm);
            const worst = algorithmScores[algorithmScores.length - 1];

            analysis.summary = {
                bestAlgorithm: best.algorithm,
                bestScore: best.compositeScore,
                currentScore: current ? current.compositeScore : 0,
                worstAlgorithm: worst.algorithm,
                worstScore: worst.compositeScore
            };

            const totalRequests = this.requestCount;
            const avgConnections = this.servers.reduce((sum, s) => sum + s.connections, 0) / this.servers.length;
            const uniqueClients = this.clientConnections.size;

            if (best.algorithm !== this.algorithm && best.compositeScore > (current?.compositeScore || 0) + 10) {
                analysis.recommendations.push({
                    type: 'improvement',
                    message: `Consider switching to ${best.algorithm} for better performance (${best.compositeScore}% vs current ${current?.compositeScore || 0}%)`
                });
            }

            if (avgConnections > 5) {
                analysis.recommendations.push({
                    type: 'high-load',
                    message: 'High connection count detected. LEAST_CONNECTIONS recommended for better load distribution.'
                });
            }

            if (currentMetrics && currentMetrics.avgResponseTime > 5) {
                analysis.recommendations.push({
                    type: 'performance',
                    message: 'High response times detected. LEAST_RESPONSE_TIME algorithm recommended for optimal performance routing.'
                });
            }

            if (this.servers.some(s => s.weight !== 1)) {
                analysis.recommendations.push({
                    type: 'weighted-servers',
                    message: 'Server weights are configured. Consider WEIGHTED_ROUND_ROBIN for better utilization.'
                });
            }

            if (totalRequests < 50) {
                analysis.recommendations.push({
                    type: 'info',
                    message: 'Limited data available. Send more requests for accurate algorithm comparison and recommendations.'
                });
            }
        } else {
            analysis.recommendations.push({
                type: 'info',
                message: 'Use different algorithms and send test requests to compare their performance.'
            });
        }

        return analysis;
    }
}
module.exports = new ServerPool();
