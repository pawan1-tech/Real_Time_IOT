/**
 * Backend API Server
 * Provides REST API for dashboard and monitoring
 */

const express = require('express');
const cors = require('cors');
// const griddb = require('griddb-node-api'); // Temporarily disabled - package is broken
const { Kafka } = require('kafkajs');
const winston = require('winston');

// Logger configuration
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// GridDB connection
let griddbStore = null;
let metricsContainer = null;

// Kafka connection for anomalies
let kafkaConsumer = null;
let latestAnomalies = [];
const MAX_ANOMALIES = 100;

// System statistics
const systemStats = {
    activeSensors: 0,
    totalMessages: 0,
    anomalyCount: 0,
    uptime: Date.now(),
    lastUpdate: Date.now()
};

/**
 * Initialize GridDB connection
 */
async function initGridDB() {
    try {
        logger.warn('GridDB is temporarily disabled (griddb-node-api package unavailable)');
        logger.warn('Metrics endpoints will return "Database not ready" responses');
        // GridDB initialization skipped - package is broken
        /*
        const factory = griddb.StoreFactory.getInstance();
        griddbStore = await factory.getStore({
            host: process.env.GRIDDB_HOST || 'localhost',
            port: parseInt(process.env.GRIDDB_PORT || '10001'),
            clusterName: process.env.GRIDDB_CLUSTER || 'iotCluster',
            username: process.env.GRIDDB_USER || 'admin',
            password: process.env.GRIDDB_PASSWORD || 'admin'
        });

        metricsContainer = await griddbStore.getContainer('infrastructure_metrics');
        logger.info('GridDB connected');
        */

    } catch (error) {
        logger.error(`GridDB connection error: ${error.message}`);
    }
}

/**
 * Initialize Kafka consumer for anomalies
 */
async function initKafka() {
    try {
        logger.info('Connecting to Kafka...');

        const kafka = new Kafka({
            clientId: 'backend-api',
            brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
        });

        kafkaConsumer = kafka.consumer({
            groupId: 'backend-api-anomalies',
            sessionTimeout: 30000
        });

        await kafkaConsumer.connect();
        await kafkaConsumer.subscribe({
            topic: 'infrastructure-anomalies',
            fromBeginning: false
        });

        // Consume anomalies
        kafkaConsumer.run({
            eachMessage: async ({ message }) => {
                try {
                    const anomaly = JSON.parse(message.value.toString());
                    latestAnomalies.unshift(anomaly);

                    // Keep only latest anomalies
                    if (latestAnomalies.length > MAX_ANOMALIES) {
                        latestAnomalies = latestAnomalies.slice(0, MAX_ANOMALIES);
                    }

                    systemStats.anomalyCount++;

                } catch (error) {
                    logger.error(`Error processing anomaly: ${error.message}`);
                }
            }
        });

        logger.info('Kafka consumer connected');

    } catch (error) {
        logger.error(`Kafka connection error: ${error.message}`);
    }
}

/**
 * API Routes
 */

// Health check
app.get('/api/v1/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: Date.now() - systemStats.uptime,
        timestamp: new Date().toISOString()
    });
});

// Get latest metrics
app.get('/api/v1/metrics/latest', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '100');

        if (!metricsContainer) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const query = metricsContainer.query(
            `SELECT * ORDER BY timestamp DESC LIMIT ${limit}`
        );

        const rowset = await query.fetch();
        const results = [];

        while (rowset.hasNext()) {
            const row = rowset.next();
            results.push({
                timestamp: row[0].toISOString(),
                device_id: row[1],
                sector: row[2],
                sensor_type: row[3],
                value: row[4],
                unit: row[5],
                data_quality_score: row[6],
                is_faulty: row[7],
                status: row[7] ? 'anomaly' : (row[6] < 0.8 ? 'warning' : 'normal')
            });
        }

        systemStats.totalMessages = results.length;
        systemStats.lastUpdate = Date.now();

        res.json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (error) {
        logger.error(`Error fetching metrics: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// Get device-specific metrics
app.get('/api/v1/devices/:deviceId/latest', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const limit = parseInt(req.query.limit || '50');

        if (!metricsContainer) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const query = metricsContainer.query(
            `SELECT * WHERE device_id = '${deviceId}' ORDER BY timestamp DESC LIMIT ${limit}`
        );

        const rowset = await query.fetch();
        const results = [];

        while (rowset.hasNext()) {
            const row = rowset.next();
            results.push({
                timestamp: row[0].toISOString(),
                sensor_type: row[3],
                value: row[4],
                unit: row[5],
                data_quality_score: row[6],
                is_faulty: row[7]
            });
        }

        res.json({
            success: true,
            device_id: deviceId,
            count: results.length,
            data: results
        });

    } catch (error) {
        logger.error(`Error fetching device metrics: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch device metrics' });
    }
});

// Get system statistics
app.get('/api/v1/stats', async (req, res) => {
    try {
        // Count unique active sensors
        if (metricsContainer) {
            const query = metricsContainer.query(
                `SELECT COUNT(DISTINCT device_id) FROM infrastructure_metrics WHERE timestamp > TIMESTAMPADD(MINUTE, NOW(), -5)`
            );

            try {
                const rowset = await query.fetch();
                if (rowset.hasNext()) {
                    systemStats.activeSensors = rowset.next()[0] || 0;
                }
            } catch (e) {
                // Query might fail if no data yet
                systemStats.activeSensors = 0;
            }
        }

        const uptimeSeconds = (Date.now() - systemStats.uptime) / 1000;

        res.json({
            success: true,
            stats: {
                active_sensors: systemStats.activeSensors * 4, // 4 sensors per device
                total_devices: systemStats.activeSensors,
                anomalies_detected: systemStats.anomalyCount,
                system_uptime: Math.floor(uptimeSeconds),
                uptime_percentage: 99.9,
                last_update: new Date(systemStats.lastUpdate).toISOString()
            }
        });

    } catch (error) {
        logger.error(`Error fetching stats: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Get latest anomalies
app.get('/api/v1/anomalies/latest', (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '50');
        const results = latestAnomalies.slice(0, limit);

        res.json({
            success: true,
            count: results.length,
            data: results
        });

    } catch (error) {
        logger.error(`Error fetching anomalies: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch anomalies' });
    }
});

// Get metrics by sector
app.get('/api/v1/metrics/sector/:sector', async (req, res) => {
    try {
        const { sector } = req.params;
        const limit = parseInt(req.query.limit || '100');

        if (!metricsContainer) {
            return res.status(503).json({ error: 'Database not ready' });
        }

        const query = metricsContainer.query(
            `SELECT * WHERE sector = '${sector}' ORDER BY timestamp DESC LIMIT ${limit}`
        );

        const rowset = await query.fetch();
        const results = [];

        while (rowset.hasNext()) {
            const row = rowset.next();
            results.push({
                timestamp: row[0].toISOString(),
                device_id: row[1],
                sensor_type: row[3],
                value: row[4],
                unit: row[5],
                data_quality_score: row[6],
                is_faulty: row[7]
            });
        }

        res.json({
            success: true,
            sector: sector,
            count: results.length,
            data: results
        });

    } catch (error) {
        logger.error(`Error fetching sector metrics: ${error.message}`);
        res.status(500).json({ error: 'Failed to fetch sector metrics' });
    }
});

/**
 * Start server
 */
async function startServer() {
    try {
        await initGridDB();
        await initKafka();

        app.listen(PORT, () => {
            logger.info(`Backend API server running on port ${PORT}`);
        });

    } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    if (kafkaConsumer) {
        await kafkaConsumer.disconnect();
    }
    process.exit(0);
});

startServer();
