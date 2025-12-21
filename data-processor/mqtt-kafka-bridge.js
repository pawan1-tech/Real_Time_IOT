/**
 * MQTT-Kafka Bridge
 * Consumes MQTT messages and publishes to Kafka
 */

const mqtt = require('mqtt');
const { Kafka } = require('kafkajs');
const logger = require('./logger');
const DataProcessor = require('./data-processor');

class MQTTKafkaBridge {
    constructor() {
        // MQTT Configuration
        this.mqttBroker = process.env.MQTT_BROKER || 'localhost';
        this.mqttPort = process.env.MQTT_PORT || 1883;
        this.mqttTopic = 'infrastructure/#';

        // Kafka Configuration
        this.kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';
        this.rawTopic = 'infrastructure-sensor-raw';
        this.processedTopic = 'infrastructure-sensor-processed';

        // GridDB Configuration
        this.griddbHost = process.env.GRIDDB_HOST || 'localhost';
        this.griddbPort = process.env.GRIDDB_PORT || 10001;

        // Components
        this.mqttClient = null;
        this.kafkaProducer = null;
        this.dataProcessor = new DataProcessor();

        // Statistics
        this.stats = {
            messagesReceived: 0,
            messagesProcessed: 0,
            messagesFailed: 0,
            duplicates: 0,
            validationErrors: 0,
            startTime: Date.now()
        };

        // Performance tracking
        this.latencySum = 0;
        this.latencyCount = 0;
    }

    /**
     * Initialize Kafka producer
     */
    async initKafka() {
        logger.info(`Connecting to Kafka at ${this.kafkaBroker}...`);

        const kafka = new Kafka({
            clientId: 'mqtt-kafka-bridge',
            brokers: [this.kafkaBroker],
            retry: {
                initialRetryTime: 100,
                retries: 8
            }
        });

        this.kafkaProducer = kafka.producer({
            allowAutoTopicCreation: true,
            transactionTimeout: 30000
        });

        await this.kafkaProducer.connect();
        logger.info('Kafka producer connected');
    }

    /**
     * Initialize MQTT client
     */
    async initMQTT() {
        logger.info(`Connecting to MQTT broker at ${this.mqttBroker}:${this.mqttPort}...`);

        this.mqttClient = mqtt.connect(`mqtt://${this.mqttBroker}:${this.mqttPort}`, {
            clientId: 'mqtt-kafka-bridge',
            clean: true,
            reconnectPeriod: 1000,
            connectTimeout: 30000
        });

        return new Promise((resolve, reject) => {
            this.mqttClient.on('connect', () => {
                logger.info('MQTT client connected');
                this.mqttClient.subscribe(this.mqttTopic, { qos: 1 }, (err) => {
                    if (err) {
                        logger.error(`Failed to subscribe to ${this.mqttTopic}: ${err.message}`);
                        reject(err);
                    } else {
                        logger.info(`Subscribed to ${this.mqttTopic}`);
                        resolve();
                    }
                });
            });

            this.mqttClient.on('error', (err) => {
                logger.error(`MQTT error: ${err.message}`);
            });

            this.mqttClient.on('message', (topic, message) => {
                this.handleMessage(topic, message);
            });

            this.mqttClient.on('reconnect', () => {
                logger.warn('MQTT reconnecting...');
            });

            this.mqttClient.on('offline', () => {
                logger.warn('MQTT client offline');
            });
        });
    }

    /**
     * Handle incoming MQTT message
     */
    async handleMessage(topic, message) {
        const receiveTime = Date.now();
        this.stats.messagesReceived++;

        try {
            // Parse message
            const rawData = message.toString();

            // Publish raw data to Kafka
            await this.kafkaProducer.send({
                topic: this.rawTopic,
                messages: [{
                    key: topic,
                    value: rawData,
                    timestamp: Date.now().toString()
                }]
            });

            // Process the data
            const result = this.dataProcessor.process(rawData);

            if (result.success) {
                // Publish processed data to Kafka
                await this.kafkaProducer.send({
                    topic: this.processedTopic,
                    messages: [{
                        key: result.data.device_id,
                        value: JSON.stringify(result.data),
                        timestamp: Date.now().toString()
                    }]
                });

                this.stats.messagesProcessed++;

                // Track latency
                const latency = Date.now() - receiveTime;
                this.latencySum += latency;
                this.latencyCount++;

            } else {
                this.stats.messagesFailed++;

                if (result.reason === 'duplicate') {
                    this.stats.duplicates++;
                } else if (result.reason === 'validation_failed') {
                    this.stats.validationErrors++;
                    logger.debug(`Validation failed: ${result.errors.join(', ')}`);
                }
            }

        } catch (error) {
            this.stats.messagesFailed++;
            logger.error(`Error handling message from ${topic}: ${error.message}`);
        }
    }

    /**
     * Start statistics reporting
     */
    startStatsReporting() {
        setInterval(() => {
            const uptime = (Date.now() - this.stats.startTime) / 1000;
            const avgLatency = this.latencyCount > 0 ?
                (this.latencySum / this.latencyCount).toFixed(2) : 0;
            const throughput = (this.stats.messagesReceived / uptime).toFixed(1);

            logger.info(`Stats: Received=${this.stats.messagesReceived}, ` +
                `Processed=${this.stats.messagesProcessed}, ` +
                `Failed=${this.stats.messagesFailed}, ` +
                `Duplicates=${this.stats.duplicates}, ` +
                `Throughput=${throughput} msg/s, ` +
                `Avg Latency=${avgLatency}ms`);
        }, 10000); // Every 10 seconds
    }

    /**
     * Start the bridge
     */
    async start() {
        try {
            logger.info('Starting MQTT-Kafka bridge...');

            await this.initKafka();
            await this.initMQTT();

            this.startStatsReporting();

            logger.info('MQTT-Kafka bridge running');

        } catch (error) {
            logger.error(`Failed to start bridge: ${error.message}`);
            throw error;
        }
    }

    /**
     * Stop the bridge
     */
    async stop() {
        logger.info('Stopping MQTT-Kafka bridge...');

        if (this.mqttClient) {
            this.mqttClient.end();
        }

        if (this.kafkaProducer) {
            await this.kafkaProducer.disconnect();
        }

        logger.info('Bridge stopped');
    }
}

module.exports = MQTTKafkaBridge;
