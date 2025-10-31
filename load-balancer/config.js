module.exports = {
    loadBalancer: {
        port: 8080,
        defaultAlgorithm: 'LEAST_CONNECTIONS',
        availableAlgorithms: [
            'ROUND_ROBIN',
            'WEIGHTED_ROUND_ROBIN',
            'LEAST_CONNECTIONS',
            'RANDOM',
            'LEAST_RESPONSE_TIME'
        ]
    },

    serverPool: {
        healthCheckInterval: 10000,
        healthCheckTimeout: 5000,
        healthCheckPath: '/api/health',
        defaultWeight: 1
    },

    initialServers: [
        { url: 'http://localhost:5001', weight: 2 },
        { url: 'http://localhost:5002', weight: 1 },
        { url: 'http://localhost:5003', weight: 1 }
    ],

    dashboard: {
        port: 3000,
        updateInterval: 2000
    },

    algorithmDescriptions: {
        'ROUND_ROBIN': 'Distributes requests sequentially across all servers. Simple and fair distribution.',
        'WEIGHTED_ROUND_ROBIN': 'Distributes requests based on server weights. More powerful servers get more traffic.',
        'LEAST_CONNECTIONS': 'Routes to the server with fewest active connections. Best for varying request durations.',
        'RANDOM': 'Randomly selects a server for each request. Minimal overhead, statistically fair.',
        'LEAST_RESPONSE_TIME': 'Routes to the server with lowest response time and current load. Performance optimized.'
    },

    proxy: {
        timeout: 30000,
        changeOrigin: true,
        preserveHeaderKeyCase: true,
        followRedirects: true
    }
};
