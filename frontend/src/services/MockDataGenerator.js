
const CARDINAL_DIRECTIONS = ['North', 'South', 'East', 'West'];
const SECTORS = ['Industrial Zone', 'Power Plant', 'Warehouse A', 'Warehouse B', 'Data Center'];
const SENSOR_TYPES = ['temperature', 'vibration', 'pressure', 'humidity'];

class MockDataGenerator {
    constructor() {
        this.devices = this.generateDevices(100);
    }

    generateDevices(count) {
        const devices = [];
        for (let i = 0; i < count; i++) {
            const id = `DEV-${String(i + 1).padStart(3, '0')}`;
            // consistent random sector for each device
            const sector = SECTORS[Math.floor(Math.random() * SECTORS.length)];
            devices.push({ id, sector });
        }
        return devices;
    }

    generateValue(type) {
        // Base values + random noise
        switch (type) {
            case 'temperature':
                // 20-80 degrees Celsius
                return (20 + Math.random() * 60).toFixed(1);
            case 'vibration':
                // 0-10 mm/s
                return (Math.random() * 10).toFixed(3);
            case 'pressure':
                // 900-1100 hPa
                return (900 + Math.random() * 200).toFixed(0);
            case 'humidity':
                // 30-90 %
                return (30 + Math.random() * 60).toFixed(0);
            default:
                return 0;
        }
    }

    getUnit(type) {
        switch (type) {
            case 'temperature': return '°C';
            case 'vibration': return 'mm/s';
            case 'pressure': return 'hPa';
            case 'humidity': return '%';
            default: return '';
        }
    }

    getMetrics(limit = 100) {
        const metrics = [];

        // Randomly pick devices to report
        const shuffled = [...this.devices].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, limit);

        selected.forEach(device => {
            const sensorType = SENSOR_TYPES[Math.floor(Math.random() * SENSOR_TYPES.length)];
            const value = parseFloat(this.generateValue(sensorType));

            // 5% chance of anomaly
            const isAnomaly = Math.random() < 0.05;
            let status = 'normal';
            let finalValue = value;

            if (isAnomaly) {
                status = 'anomaly';
                // Spike the value
                finalValue = value * 1.5;
            } else if (Math.random() < 0.1) {
                status = 'warning';
                finalValue = value * 1.2;
            }

            metrics.push({
                device_id: device.id,
                sector: device.sector,
                sensor_type: sensorType,
                value: finalValue.toFixed(sensorType === 'vibration' ? 3 : 1),
                unit: this.getUnit(sensorType),
                data_quality_score: 0.8 + (Math.random() * 0.2), // 80-100%
                status: status,
                timestamp: new Date().toISOString()
            });
        });

        return metrics.sort((a, b) => b.status.localeCompare(a.status)); // Anomalies first
    }

    getStats() {
        return {
            active_sensors: 100 * 4, // 4 sensors per device
            total_devices: 100,
            anomalies_detected: Math.floor(Math.random() * 15),
            system_uptime: 12345 + Math.floor(Math.random() * 100),
            uptime_percentage: 99.99
        };
    }

    getAnomalies(limit = 10) {
        // Generate pure anomaly list
        const anomalies = [];
        for (let i = 0; i < limit; i++) {
            const device = this.devices[Math.floor(Math.random() * this.devices.length)];
            const type = SENSOR_TYPES[Math.floor(Math.random() * SENSOR_TYPES.length)];
            anomalies.push({
                device_id: device.id,
                sector: device.sector,
                sensor_type: type,
                current_value: (Math.random() * 100).toFixed(1),
                unit: this.getUnit(type),
                anomaly_score: 0.85 + (Math.random() * 0.14),
                confidence: 0.90 + (Math.random() * 0.09),
                timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString() // last hour
            });
        }
        return anomalies;
    }
}

export default new MockDataGenerator();
