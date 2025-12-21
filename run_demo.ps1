# IoT Platform Demo Startup Script (PowerShell)
# This script starts all services and prepares the demo

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "  IoT Infrastructure Monitoring Platform" -ForegroundColor Cyan
Write-Host "  Demo Startup Script" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error: Docker is not running" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Check if .env file exists
if (-not (Test-Path .env)) {
    Write-Host "⚠️  No .env file found. Creating from template..." -ForegroundColor Yellow
    Copy-Item .env.example .env
    Write-Host "✅ Created .env file. Please configure it with your credentials." -ForegroundColor Green
    Write-Host ""
}

# Clean up any existing containers
Write-Host "🧹 Cleaning up existing containers..." -ForegroundColor Yellow
docker-compose down -v
Write-Host ""

# Build and start all services
Write-Host "🚀 Starting all services..." -ForegroundColor Cyan
Write-Host "This may take a few minutes on first run..." -ForegroundColor Yellow
Write-Host ""

docker-compose up -d --build

Write-Host ""
Write-Host "⏳ Waiting for services to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Check service health
Write-Host ""
Write-Host "📊 Service Status:" -ForegroundColor Cyan
docker-compose ps

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "  ✅ Demo is Ready!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📡 Services:" -ForegroundColor Cyan
Write-Host "  - Frontend Dashboard: http://localhost:3000"
Write-Host "  - Backend API: http://localhost:5000"
Write-Host "  - MQTT Broker: mqtt://localhost:1883"
Write-Host "  - Kafka: localhost:9093"
Write-Host ""
Write-Host "📈 What's happening:" -ForegroundColor Cyan
Write-Host "  - 100 IoT devices are generating sensor data"
Write-Host "  - 30% of devices have injected faults"
Write-Host "  - Data flows: MQTT → Kafka → Processing → GridDB"
Write-Host "  - ML models detect anomalies in real-time"
Write-Host "  - Alerts are sent for critical anomalies"
Write-Host ""
Write-Host "🎯 Demo Tips:" -ForegroundColor Cyan
Write-Host "  - Open http://localhost:3000 to see the dashboard"
Write-Host "  - Dashboard auto-refreshes every 5 seconds"
Write-Host "  - Watch for anomalies appearing in real-time"
Write-Host "  - Check logs: docker-compose logs -f [service-name]"
Write-Host ""
Write-Host "🛑 To stop the demo:" -ForegroundColor Yellow
Write-Host "  - Press Ctrl+C or run: docker-compose down"
Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Ask to follow logs
$response = Read-Host "Would you like to follow the logs? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    docker-compose logs -f
}
