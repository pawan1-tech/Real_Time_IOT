#!/bin/bash

# IoT Platform Demo Startup Script
# This script starts all services and prepares the demo

echo "========================================="
echo "  IoT Infrastructure Monitoring Platform"
echo "  Demo Startup Script"
echo "========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cp .env.example .env
    echo "✅ Created .env file. Please configure it with your credentials."
    echo ""
fi

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down -v
echo ""

# Build and start all services
echo "🚀 Starting all services..."
echo "This may take a few minutes on first run..."
echo ""

docker-compose up -d --build

echo ""
echo "⏳ Waiting for services to initialize..."
sleep 30

# Check service health
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "========================================="
echo "  ✅ Demo is Ready!"
echo "========================================="
echo ""
echo "📡 Services:"
echo "  - Frontend Dashboard: http://localhost:3000"
echo "  - Backend API: http://localhost:5000"
echo "  - MQTT Broker: mqtt://localhost:1883"
echo "  - Kafka: localhost:9093"
echo ""
echo "📈 What's happening:"
echo "  - 100 IoT devices are generating sensor data"
echo "  - 30% of devices have injected faults"
echo "  - Data flows: MQTT → Kafka → Processing → GridDB"
echo "  - ML models detect anomalies in real-time"
echo "  - Alerts are sent for critical anomalies"
echo ""
echo "🎯 Demo Tips:"
echo "  - Open http://localhost:3000 to see the dashboard"
echo "  - Dashboard auto-refreshes every 5 seconds"
echo "  - Watch for anomalies appearing in real-time"
echo "  - Check logs: docker-compose logs -f [service-name]"
echo ""
echo "🛑 To stop the demo:"
echo "  - Press Ctrl+C or run: docker-compose down"
echo ""
echo "========================================="
echo ""

# Follow logs (optional)
read -p "Would you like to follow the logs? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    docker-compose logs -f
fi
