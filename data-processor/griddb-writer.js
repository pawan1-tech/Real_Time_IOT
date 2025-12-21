/**
 * GridDB Writer
 * Consumes processed data from Kafka and writes to GridDB
 */

const { Kafka } = require('kafkajs');
// const griddb = require('griddb-node-api'); // Temporarily disabled - package is broken
const logger = require('./logger');

class GridDBWriter {
    constructor() {
        // Kafka Configuration
        this.kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';
        this.processedTopic = 'infrastructure-sensor-processed';
        this.consumerGroup = 'griddb-writer';

        // GridDB Configuration
        this.griddbHost = process.env.GRIDDB_HOST || 'localhost';
        this.griddbPort = parseInt(process.env.GRIDDB_PORT || '10001');
        this.griddbCluster = process.env.GRIDDB_CLUSTER || 'iotCluster';
        this.griddbUser = process.env.GRIDDB_USER || 'admin';
        this.griddbPassword = process.env.GRIDDB_PASSWORD || 'admin';

        this.kafkaConsumer = null;
        this.griddbStore = null;
        this.container = null;

        // Batch writing
        this.batchSize = 1000;
        this.batch = [];
        this.batchTimeout = null;
        this.batchFlushInterval = 5000; // 5 seconds

        // Statistics
        this.stats = {
            messagesConsumed: 0,
            rowsInserted: 0,
            errors: 0,
            startTime: Date.now()
        };
    }

    /**
     * Initialize GridDB connection
     */
    async initGridDB() {
        logger.warn('GridDB is temporarily disabled (griddb-node-api package unavailable)');
        logger.warn('Data will be consumed from Kafka but not written to GridDB');
        // GridDB initialization skipped - package is broken
        /*
        logger.info(`Connecting to GridDB at ${this.griddbHost}:${this.griddbPort}...`);

        try {
            const factory = griddb.StoreFactory.getInstance();
            this.griddbStore = await factory.getStore({
                host: this.griddbHost,
                port: this.griddbPort,
                clusterName: this.griddbCluster,
                username: this.griddbUser,
                password: this.griddbPassword
            });

            // Create container if not exists
            const conInfo = new griddb.ContainerInfo({
                name: 'infrastructure_metrics',
                columnInfoList: [
                    ['timestamp', griddb.Type.TIMESTAMP],
                    ['device_id', griddb.Type.STRING],
                    ['sector', griddb.Type.STRING],
                    ['sensor_type', griddb.Type.STRING],
                    ['value', griddb.Type.DOUBLE],
                    ['unit', griddb.Type.STRING],
                    ['data_quality_score', griddb.Type.DOUBLE],
                    ['is_faulty', griddb.Type.BOOL],
                    ['processed_at', griddb.Type.TIMESTAMP]
                ],
                type: griddb.ContainerType.TIME_SERIES,
                rowKey: true
            });

            this.container = await this.griddbStore.putContainer(conInfo);

            // Create indexes
            await this.container.createIndex('device_id', griddb.IndexType.DEFAULT);
            await this.container.createIndex('sensor_type', griddb.IndexType.DEFAULT);

            logger.info('GridDB connected and container ready');

        } catch (error) {
            logger.error(`GridDB initialization error: ${error.message}`);
            throw error;
        }
        */
    }

    /**
     * Initialize Kafka consumer
     */
    async initKafka() {
        logger.info(`Connecting to Kafka at ${this.kafkaBroker}...`);

        const kafka = new Kafka({
            clientId: 'griddb-writer',
            brokers: [this.kafkaBroker],
            retry: {
                initialRetryTime: 100,
                retries: 8
            }
        });

        this.kafkaConsumer = kafka.consumer({
            groupId: this.consumerGroup,
            sessionTimeout: 30000,
            heartbeatInterval: 3000
        });

        await this.kafkaConsumer.connect();
        await this.kafkaConsumer.subscribe({
            topic: this.processedTopic,
            fromBeginning: false
        });

        logger.info('Kafka consumer connected');
    }

    /**
     * Add row to batch
     */
    addToBatch(data) {
        try {
            const row = [
                new Date(data.timestamp),
                data.device_id,
                data.sector,
                data.sensor_type,
                parseFloat(data.value),
                data.unit || '',
                parseFloat(data.data_quality_score || 1.0),
                Boolean(data.is_faulty),
                new Date(data.processed_at || Date.now())
            ];

            this.batch.push(row);

            // Flush if batch is full
            if (this.batch.length >= this.batchSize) {
                this.flushBatch();
            }

        } catch (error) {
            logger.error(`Error adding to batch: ${error.message}`);
            this.stats.errors++;
        }
    }

    /**
     * Flush batch to GridDB
     */
    async flushBatch() {
        if (this.batch.length === 0) return;

        try {
            // GridDB is disabled, just clear the batch
            if (!this.container) {
                logger.debug(`Skipping flush of ${this.batch.length} rows (GridDB disabled)`);
                this.batch = [];
                return;
            }

            await this.container.multiPut(this.batch);
            this.stats.rowsInserted += this.batch.length;

            logger.debug(`Flushed ${this.batch.length} rows to GridDB`);
            this.batch = [];

        } catch (error) {
            logger.error(`Error flushing batch: ${error.message}`);
            this.stats.errors++;
            this.batch = []; // Clear batch to prevent infinite retry
        }
    }

    /**
     * Start periodic batch flushing
     */
    startPeriodicFlush() {
        setInterval(() => {
            this.flushBatch();
        }, this.batchFlushInterval);
    }

    /**
     * Start consuming from Kafka
     */
    async startConsuming() {
        await this.kafkaConsumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const data = JSON.parse(message.value.toString());
                    this.addToBatch(data);
                    this.stats.messagesConsumed++;

                } catch (error) {
                    logger.error(`Error processing message: ${error.message}`);
                    this.stats.errors++;
                }
            }
        });
    }

    /**
     * Start statistics reporting
     */
    startStatsReporting() {
        setInterval(() => {
            const uptime = (Date.now() - this.stats.startTime) / 1000;
            const throughput = (this.stats.rowsInserted / uptime).toFixed(1);

            logger.info(`GridDB Stats: Consumed=${this.stats.messagesConsumed}, ` +
                `Inserted=${this.stats.rowsInserted}, ` +
                `Errors=${this.stats.errors}, ` +
                `Throughput=${throughput} rows/s, ` +
                `Batch size=${this.batch.length}`);
        }, 10000); // Every 10 seconds
    }

    /**
     * Start the writer
     */
    async start() {
        try {
            logger.info('Starting GridDB writer...');

            await this.initGridDB();
            await this.initKafka();

            this.startPeriodicFlush();
            this.startStatsReporting();

            await this.startConsuming();

            logger.info('GridDB writer running');

        } catch (error) {
            logger.error(`Failed to start GridDB writer: ${error.message}`);
            throw error;
        }
    }

    /**
     * Stop the writer
     */
    async stop() {
        logger.info('Stopping GridDB writer...');

        // Flush remaining batch
        await this.flushBatch();

        if (this.kafkaConsumer) {
            await this.kafkaConsumer.disconnect();
        }

        logger.info('GridDB writer stopped');
    }
}

module.exports = GridDBWriter;
