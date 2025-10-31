# Platefull Load Balanced System

A comprehensive load balancing solution for the Platefull food sharing application. This system runs multiple instances of Platefull servers and intelligently distributes traffic across them using various load balancing algorithms.

## 🎯 Features

- **Multiple Load Balancing Algorithms:**
  - Round Robin
  - Weighted Round Robin
  - Least Connections
  - Weighted Least Connections
  - Random
  - IP Hash (Session Persistence)
  - Least Response Time

- **Real-time Monitoring Dashboard:**
  - View active servers and their status
  - Monitor client connections per server
  - See current load balancing algorithm
  - Real-time metrics and statistics
  - Test load distribution

- **Health Checks:**
  - Automatic health monitoring of all server instances
  - Automatic failover to healthy servers
  - Recovery detection

## 📁 Project Structure

```
Platefull-LoadBalanced/
├── load-balancer/          # Load balancer core
│   ├── load-balancer.js    # Main load balancer
│   ├── server-pool.js      # Server pool management
│   ├── config.js           # Configuration
│   └── package.json
├── dashboard/              # Admin monitoring dashboard
│   ├── server.js           # Dashboard server
│   ├── package.json
│   └── public/
│       ├── index.html
│       ├── app.js
│       └── style.css
├── server-instances/       # Multiple Platefull instances
│   ├── start-instance.js   # Server instance launcher
│   └── package.json
├── START_ALL.bat          # Start everything (Windows)
└── README.md
```

## 🚀 Quick Start

### Prerequisites

1. Node.js and npm installed
2. MongoDB running locally or connection string ready
3. Original Platefull project files accessible

### Installation

1. **Install all dependencies:**
   ```powershell
   cd load-balancer
   npm install

   cd ../dashboard
   npm install

   cd ../server-instances
   npm install
   ```

2. **Configure environment variables:**
   - Copy the `.env` file from your original Platefull project
   - Update MongoDB URI if needed
   - The system will use this for all server instances

### Running the System

**Option 1: Using the batch file (Windows)**
```powershell
START_ALL.bat
```

**Option 2: Manual start (All platforms)**

1. **Start Server Instances (in separate terminals):**
   ```powershell
   cd server-instances
   node start-instance.js 5001
   node start-instance.js 5002
   node start-instance.js 5003
   ```

2. **Start Load Balancer:**
   ```powershell
   cd load-balancer
   npm start
   ```

3. **Start Dashboard:**
   ```powershell
   cd dashboard
   npm start
   ```

4. **Start Frontend (original Platefull client):**
   ```powershell
   cd path/to/original/Platefull/client
   npm run dev
   ```

### Access Points

- **Application (via Load Balancer):** http://localhost:8080
- **Admin Dashboard:** http://localhost:3000
- **Direct Server Access:**
  - Server 1: http://localhost:5001
  - Server 2: http://localhost:5002
  - Server 3: http://localhost:5003

## 🎮 Using the Dashboard

1. Open http://localhost:3000 in your browser
2. View real-time server status and connections
3. Change load balancing algorithms on the fly
4. Test load distribution with the test buttons
5. Monitor metrics like response times and request counts

## 📊 Load Balancing Algorithms

### Round Robin
Distributes requests sequentially across all servers. Simple and effective for servers with similar capabilities.

### Weighted Round Robin
Similar to Round Robin but considers server weights. More powerful servers get more requests.

### Least Connections
Routes traffic to the server with the fewest active connections. Ideal for varying request processing times.

### Weighted Least Connections
Combines least connections with server weights. Balances load based on both capacity and current connections.

### Random
Randomly selects a server for each request. Simple distribution with minimal overhead.

### IP Hash
Routes requests from the same client IP to the same server. Provides session persistence without sticky sessions.

### Least Response Time
Routes to the server with the best response time and lowest load. Optimizes for performance.

## 🔧 Configuration

Edit `load-balancer/config.js` to customize:

- Load balancer port
- Health check intervals
- Server weights
- Default algorithm
- And more...

## 🧪 Testing

Use the dashboard's test buttons to:
- Send single requests
- Send 10 requests at once
- Send 50 requests for load testing
- Observe how different algorithms distribute the load

## 📝 API Endpoints

### Load Balancer Admin API (http://localhost:8080/admin)

- `GET /admin/pool` - Get all server statuses
- `GET /admin/metrics` - Get performance metrics
- `GET /admin/algorithm` - Get current algorithm
- `POST /admin/algorithm` - Change algorithm
  ```json
  { "algorithm": "ROUND_ROBIN" }
  ```
- `POST /admin/servers` - Add server
- `DELETE /admin/servers` - Remove server
- `PATCH /admin/servers` - Update server weight

## 🛠️ Troubleshooting

### Servers not starting
- Check MongoDB connection
- Verify ports are not in use
- Check environment variables

### Load balancer shows all servers DOWN
- Ensure server instances are running
- Check health endpoint: http://localhost:5001/api/health
- Verify firewall settings

### Dashboard not updating
- Check browser console for errors
- Verify load balancer is running on port 8080
- Check CORS settings

## 🎓 How It Works

1. **Server Instances:** Multiple copies of the Platefull server run on different ports (5001, 5002, 5003)
2. **Load Balancer:** Sits on port 8080 and proxies requests to healthy servers based on the selected algorithm
3. **Health Checks:** Every 10 seconds, the load balancer checks if servers are healthy
4. **Connection Tracking:** Tracks active connections per server for intelligent routing
5. **Metrics:** Collects response times, success rates, and other performance data
6. **Dashboard:** Provides real-time visualization and control

## 📈 Performance Tips

1. **Use Weighted Algorithms:** Assign higher weights to more powerful servers
2. **Monitor Response Times:** Switch to LEAST_RESPONSE_TIME during high load
3. **Scale Horizontally:** Add more server instances as load increases

## 🔐 Security Considerations

- This is a development/demonstration setup
- For production, add:
  - Authentication for admin endpoints
  - HTTPS/TLS encryption
  - Rate limiting
  - Input validation
  - Security headers

## 📄 License

Based on the Platefull project. Use according to your original project's license.

## 🤝 Contributing

This is a custom integration for Platefull. Modify as needed for your use case.

---

**Enjoy your load-balanced Platefull application! 🚀**
