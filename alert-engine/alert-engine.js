/**
 * Alert Engine
 * Multi-channel alert routing with throttling
 */

const { Kafka } = require('kafkajs');
const nodemailer = require('nodemailer');
const axios = require('axios');
const winston = require('winston');

// Logger
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

class AlertEngine {
    constructor() {
        // Kafka configuration
        this.kafkaBroker = process.env.KAFKA_BROKER || 'localhost:9092';
        this.anomalyTopic = 'infrastructure-anomalies';

        // Email configuration
        this.smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        this.smtpPort = parseInt(process.env.SMTP_PORT || '587');
        this.smtpUser = process.env.SMTP_USER;
        this.smtpPassword = process.env.SMTP_PASSWORD;

        // Slack configuration
        this.slackWebhook = process.env.SLACK_WEBHOOK_URL;

        // Alert throttling (1 hour cooldown per device:sensor)
        this.cooldownHours = parseInt(process.env.ALERT_COOLDOWN_HOURS || '1');
        this.alertCache = new Map(); // {device_id:sensor_type: timestamp}

        // Email transporter
        this.emailTransporter = null;
        if (this.smtpUser && this.smtpPassword) {
            this.emailTransporter = nodemailer.createTransport({
                host: this.smtpHost,
                port: this.smtpPort,
                secure: false,
                auth: {
                    user: this.smtpUser,
                    pass: this.smtpPassword
                }
            });
        }

        // Kafka consumer
        this.consumer = null;

        // Statistics
        this.stats = {
            anomaliesReceived: 0,
            alertsSent: 0,
            alertsThrottled: 0,
            emailsSent: 0,
            slackSent: 0,
            startTime: Date.now()
        };
    }

    /**
     * Check if alert should be throttled
     */
    shouldThrottle(deviceId, sensorType) {
        const key = `${deviceId}:${sensorType}`;
        const now = Date.now();

        if (this.alertCache.has(key)) {
            const lastAlert = this.alertCache.get(key);
            const hoursSince = (now - lastAlert) / (1000 * 60 * 60);

            if (hoursSince < this.cooldownHours) {
                return true;
            }
        }

        this.alertCache.set(key, now);
        return false;
    }

    /**
     * Get recommended actions based on sensor type
     */
    getRecommendedActions(sensorType) {
        const actions = {
            temperature: [
                'Check cooling system immediately',
                'Inspect ventilation and airflow',
                'Verify thermostat settings',
                'Schedule maintenance within 24 hours'
            ],
            vibration: [
                'Schedule maintenance within 48 hours',
                'Equipment failure risk detected',
                'Inspect mechanical components',
                'Check for loose connections or wear'
            ],
            pressure: [
                'Check for leaks in the system',
                'Inspect seals and connections',
                'Verify pressure regulator settings',
                'Monitor closely for next 24 hours'
            ],
            humidity: [
                'Check environmental controls',
                'Inspect for water intrusion',
                'Verify dehumidifier operation',
                'Review HVAC system performance'
            ]
        };

        return actions[sensorType] || ['Investigate anomaly', 'Contact maintenance team'];
    }

    /**
     * Create HTML email template
     */
    createEmailHTML(anomaly) {
        const severity = anomaly.confidence > 0.8 ? 'CRITICAL' : 'WARNING';
        const severityColor = severity === 'CRITICAL' ? '#dc3545' : '#ffc107';
        const actions = this.getRecommendedActions(anomaly.sensor_type);

        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: ${severityColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
        .metric { margin: 10px 0; padding: 10px; background: white; border-left: 4px solid ${severityColor}; }
        .actions { background: #e7f3ff; padding: 15px; margin-top: 20px; border-radius: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🚨 ${severity} Alert: Infrastructure Anomaly Detected</h2>
        </div>
        <div class="content">
            <div class="metric">
                <strong>Device ID:</strong> ${anomaly.device_id}
            </div>
            <div class="metric">
                <strong>Sector:</strong> ${anomaly.sector}
            </div>
            <div class="metric">
                <strong>Sensor Type:</strong> ${anomaly.sensor_type}
            </div>
            <div class="metric">
                <strong>Current Value:</strong> ${anomaly.current_value} ${anomaly.unit}
            </div>
            <div class="metric">
                <strong>Anomaly Score:</strong> ${(anomaly.anomaly_score * 100).toFixed(1)}%
            </div>
            <div class="metric">
                <strong>Confidence:</strong> ${(anomaly.confidence * 100).toFixed(1)}%
            </div>
            <div class="metric">
                <strong>Timestamp:</strong> ${new Date(anomaly.timestamp).toLocaleString()}
            </div>
            
            <div class="actions">
                <h3>Recommended Actions:</h3>
                <ul>
                    ${actions.map(action => `<li>${action}</li>`).join('')}
                </ul>
            </div>
        </div>
        <div class="footer">
            <p>IoT Infrastructure Monitoring Platform</p>
            <p>This is an automated alert. Do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Send email alert
     */
    async sendEmail(anomaly) {
        if (!this.emailTransporter || !this.smtpUser) {
            logger.warn('Email not configured, skipping email alert');
            return false;
        }

        try {
            const severity = anomaly.confidence > 0.8 ? 'CRITICAL' : 'WARNING';

            await this.emailTransporter.sendMail({
                from: this.smtpUser,
                to: this.smtpUser, // Send to self for demo
                subject: `${severity}: Anomaly in ${anomaly.device_id} - ${anomaly.sensor_type}`,
                html: this.createEmailHTML(anomaly)
            });

            this.stats.emailsSent++;
            logger.info(`Email alert sent for ${anomaly.device_id}:${anomaly.sensor_type}`);
            return true;

        } catch (error) {
            logger.error(`Failed to send email: ${error.message}`);
            return false;
        }
    }

    /**
     * Send Slack alert
     */
    async sendSlack(anomaly) {
        if (!this.slackWebhook) {
            logger.warn('Slack webhook not configured, skipping Slack alert');
            return false;
        }

        try {
            const severity = anomaly.confidence > 0.8 ? 'CRITICAL' : 'WARNING';
            const color = severity === 'CRITICAL' ? 'danger' : 'warning';
            const actions = this.getRecommendedActions(anomaly.sensor_type);

            const payload = {
                attachments: [{
                    color: color,
                    title: `🚨 ${severity}: Infrastructure Anomaly Detected`,
                    fields: [
                        { title: 'Device ID', value: anomaly.device_id, short: true },
                        { title: 'Sector', value: anomaly.sector, short: true },
                        { title: 'Sensor Type', value: anomaly.sensor_type, short: true },
                        { title: 'Current Value', value: `${anomaly.current_value} ${anomaly.unit}`, short: true },
                        { title: 'Anomaly Score', value: `${(anomaly.anomaly_score * 100).toFixed(1)}%`, short: true },
                        { title: 'Confidence', value: `${(anomaly.confidence * 100).toFixed(1)}%`, short: true }
                    ],
                    text: `*Recommended Actions:*\n${actions.map(a => `• ${a}`).join('\n')}`,
                    footer: 'IoT Infrastructure Monitoring',
                    ts: Math.floor(new Date(anomaly.timestamp).getTime() / 1000)
                }]
            };

            await axios.post(this.slackWebhook, payload);

            this.stats.slackSent++;
            logger.info(`Slack alert sent for ${anomaly.device_id}:${anomaly.sensor_type}`);
            return true;

        } catch (error) {
            logger.error(`Failed to send Slack alert: ${error.message}`);
            return false;
        }
    }

    /**
     * Process anomaly and route alerts
     */
    async processAnomaly(anomaly) {
        this.stats.anomaliesReceived++;

        // Check throttling
        if (this.shouldThrottle(anomaly.device_id, anomaly.sensor_type)) {
            this.stats.alertsThrottled++;
            logger.debug(`Alert throttled for ${anomaly.device_id}:${anomaly.sensor_type}`);
            return;
        }

        // Classify severity
        const isCritical = anomaly.confidence > 0.8;

        // Route alerts
        if (isCritical) {
            // CRITICAL: Send to both email and Slack
            await Promise.all([
                this.sendEmail(anomaly),
                this.sendSlack(anomaly)
            ]);
        } else {
            // WARNING: Send to email only
            await this.sendEmail(anomaly);
        }

        this.stats.alertsSent++;
    }

    /**
     * Initialize Kafka consumer
     */
    async initKafka() {
        logger.info(`Connecting to Kafka at ${this.kafkaBroker}...`);

        const kafka = new Kafka({
            clientId: 'alert-engine',
            brokers: [this.kafkaBroker]
        });

        this.consumer = kafka.consumer({
            groupId: 'alert-engine',
            sessionTimeout: 30000
        });

        await this.consumer.connect();
        await this.consumer.subscribe({
            topic: this.anomalyTopic,
            fromBeginning: false
        });

        logger.info('Kafka consumer connected');
    }

    /**
     * Start consuming anomalies
     */
    async start() {
        try {
            logger.info('Starting alert engine...');

            await this.initKafka();

            logger.info(`Consuming from ${this.anomalyTopic}`);
            logger.info('Alert engine running');

            // Start statistics reporting
            setInterval(() => this.logStats(), 10000);

            await this.consumer.run({
                eachMessage: async ({ message }) => {
                    try {
                        const anomaly = JSON.parse(message.value.toString());

                        if (anomaly.is_anomaly) {
                            await this.processAnomaly(anomaly);
                        }

                    } catch (error) {
                        logger.error(`Error processing message: ${error.message}`);
                    }
                }
            });

        } catch (error) {
            logger.error(`Failed to start alert engine: ${error.message}`);
            throw error;
        }
    }

    /**
     * Log statistics
     */
    logStats() {
        const uptime = (Date.now() - this.stats.startTime) / 1000;

        logger.info(`Stats: Anomalies=${this.stats.anomaliesReceived}, ` +
            `Alerts Sent=${this.stats.alertsSent}, ` +
            `Throttled=${this.stats.alertsThrottled}, ` +
            `Emails=${this.stats.emailsSent}, ` +
            `Slack=${this.stats.slackSent}`);
    }

    /**
     * Stop the engine
     */
    async stop() {
        logger.info('Stopping alert engine...');

        if (this.consumer) {
            await this.consumer.disconnect();
        }

        this.logStats();
        logger.info('Alert engine stopped');
    }
}

// Start the engine
const engine = new AlertEngine();

process.on('SIGINT', async () => {
    await engine.stop();
    process.exit(0);
});

engine.start().catch(error => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
