/**
 * Main Entry Point for Data Processor
 * Orchestrates MQTT-Kafka bridge and GridDB writer
 */

require('dotenv').config();
const logger = require('./logger');
const MQTTKafkaBridge = require('./mqtt-kafka-bridge');
const GridDBWriter = require('./griddb-writer');

class DataProcessorService {
    constructor() {
        this.bridge = new MQTTKafkaBridge();
        this.writer = new GridDBWriter();
    }

    async start() {
        try {
            logger.info('=== IoT Data Processor Service ===');
            logger.info('Starting all components...');

            // Start bridge first (MQTT -> Kafka)
            await this.bridge.start();

            // Wait a bit for Kafka topics to be created
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Start GridDB writer (Kafka -> GridDB)
            await this.writer.start();

            logger.info('All components running successfully');

        } catch (error) {
            logger.error(`Failed to start service: ${error.message}`);
            process.exit(1);
        }
    }

    async stop() {
        logger.info('Shutting down service...');

        await this.writer.stop();
        await this.bridge.stop();

        logger.info('Service stopped');
        process.exit(0);
    }
}

// Handle graceful shutdown
const service = new DataProcessorService();

process.on('SIGINT', async () => {
    logger.info('Received SIGINT signal');
    await service.stop();
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM signal');
    await service.stop();
});

// Start the service
service.start().catch(error => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
