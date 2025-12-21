/**
 * Data Processor
 * Validates, deduplicates, normalizes sensor data and scores quality
 */

const logger = require('./logger');

class DataProcessor {
    constructor() {
        // Deduplication cache (stores message hashes with timestamps)
        this.messageCache = new Map();
        this.cacheCleanupInterval = 60000; // Clean cache every 60 seconds
        this.duplicateWindow = 100; // 100ms window for duplicate detection

        // Sensor validation ranges
        this.sensorRanges = {
            temperature: { min: -50, max: 150, unit: '°C' },
            vibration: { min: 0, max: 100, unit: 'mm/s' },
            pressure: { min: 0, max: 200, unit: 'bar' },
            humidity: { min: 0, max: 100, unit: '%' }
        };

        // Start cache cleanup
        this.startCacheCleanup();

        logger.info('Data processor initialized');
    }

    /**
     * Generate message hash for deduplication
     */
    generateMessageHash(data) {
        return `${data.device_id}_${data.sensor_type}_${data.value}_${data.timestamp}`;
    }

    /**
     * Check if message is a duplicate
     */
    isDuplicate(data) {
        const hash = this.generateMessageHash(data);
        const now = Date.now();

        if (this.messageCache.has(hash)) {
            const cachedTime = this.messageCache.get(hash);
            if (now - cachedTime < this.duplicateWindow) {
                return true;
            }
        }

        this.messageCache.set(hash, now);
        return false;
    }

    /**
     * Validate sensor data
     */
    validate(data) {
        const errors = [];

        // Check required fields
        const requiredFields = ['timestamp', 'device_id', 'sensor_type', 'value', 'sector'];
        for (const field of requiredFields) {
            if (!(field in data)) {
                errors.push(`Missing required field: ${field}`);
            }
        }

        if (errors.length > 0) {
            return { valid: false, errors };
        }

        // Validate sensor type
        if (!(data.sensor_type in this.sensorRanges)) {
            errors.push(`Invalid sensor type: ${data.sensor_type}`);
        }

        // Validate value type
        if (typeof data.value !== 'number') {
            errors.push(`Value must be a number, got ${typeof data.value}`);
        }

        // Validate value range
        const range = this.sensorRanges[data.sensor_type];
        if (range && (data.value < range.min || data.value > range.max)) {
            errors.push(`Value ${data.value} out of range [${range.min}, ${range.max}] for ${data.sensor_type}`);
        }

        // Validate timestamp
        try {
            const timestamp = new Date(data.timestamp);
            if (isNaN(timestamp.getTime())) {
                errors.push('Invalid timestamp format');
            }
        } catch (e) {
            errors.push('Invalid timestamp');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Normalize sensor data
     */
    normalize(data) {
        const normalized = { ...data };

        // Ensure unit is set
        if (!normalized.unit && normalized.sensor_type in this.sensorRanges) {
            normalized.unit = this.sensorRanges[normalized.sensor_type].unit;
        }

        // Round value to 2 decimal places
        normalized.value = Math.round(normalized.value * 100) / 100;

        // Ensure timestamp is ISO format
        if (normalized.timestamp) {
            try {
                normalized.timestamp = new Date(normalized.timestamp).toISOString();
            } catch (e) {
                // Keep original if conversion fails
            }
        }

        return normalized;
    }

    /**
     * Calculate data quality score
     */
    calculateQualityScore(data) {
        let score = 1.0;

        // Use existing quality score if available
        if (data.data_quality_score !== undefined) {
            score = data.data_quality_score;
        } else {
            // Calculate based on freshness
            try {
                const timestamp = new Date(data.timestamp);
                const now = new Date();
                const ageMs = now - timestamp;
                const ageSeconds = ageMs / 1000;

                // Degrade quality based on age
                if (ageSeconds > 60) {
                    score *= 0.8; // Old data
                } else if (ageSeconds > 30) {
                    score *= 0.9;
                }

                // Check if value is at extremes (might indicate sensor issue)
                const range = this.sensorRanges[data.sensor_type];
                if (range) {
                    const rangeSize = range.max - range.min;
                    const distanceFromMin = Math.abs(data.value - range.min);
                    const distanceFromMax = Math.abs(data.value - range.max);

                    if (distanceFromMin < rangeSize * 0.05 || distanceFromMax < rangeSize * 0.05) {
                        score *= 0.95; // Near extremes
                    }
                }
            } catch (e) {
                score *= 0.7; // Timestamp issues
            }
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Process a single message
     */
    process(rawData) {
        const startTime = Date.now();

        try {
            // Parse if string
            const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

            // Check for duplicates
            if (this.isDuplicate(data)) {
                return {
                    success: false,
                    reason: 'duplicate',
                    processingTime: Date.now() - startTime
                };
            }

            // Validate
            const validation = this.validate(data);
            if (!validation.valid) {
                return {
                    success: false,
                    reason: 'validation_failed',
                    errors: validation.errors,
                    processingTime: Date.now() - startTime
                };
            }

            // Normalize
            const normalized = this.normalize(data);

            // Calculate quality score
            normalized.data_quality_score = this.calculateQualityScore(normalized);

            // Add processing metadata
            normalized.processed_at = new Date().toISOString();
            normalized.processing_time_ms = Date.now() - startTime;

            return {
                success: true,
                data: normalized,
                processingTime: Date.now() - startTime
            };

        } catch (error) {
            logger.error(`Processing error: ${error.message}`);
            return {
                success: false,
                reason: 'processing_error',
                error: error.message,
                processingTime: Date.now() - startTime
            };
        }
    }

    /**
     * Clean old entries from cache
     */
    cleanCache() {
        const now = Date.now();
        const cutoff = now - (this.duplicateWindow * 10); // Keep 10x window

        let cleaned = 0;
        for (const [hash, timestamp] of this.messageCache.entries()) {
            if (timestamp < cutoff) {
                this.messageCache.delete(hash);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug(`Cleaned ${cleaned} entries from cache`);
        }
    }

    /**
     * Start periodic cache cleanup
     */
    startCacheCleanup() {
        setInterval(() => {
            this.cleanCache();
        }, this.cacheCleanupInterval);
    }

    /**
     * Get processor statistics
     */
    getStats() {
        return {
            cacheSize: this.messageCache.size,
            duplicateWindow: this.duplicateWindow,
            supportedSensors: Object.keys(this.sensorRanges)
        };
    }
}

module.exports = DataProcessor;
