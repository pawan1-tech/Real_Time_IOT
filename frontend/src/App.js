import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
    const [stats, setStats] = useState({
        active_sensors: 0,
        total_devices: 0,
        anomalies_detected: 0,
        system_uptime: 0,
        uptime_percentage: 99.9
    });

    const [metrics, setMetrics] = useState([]);
    const [anomalies, setAnomalies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch system statistics
    const fetchStats = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/v1/stats`);
            if (response.data.success) {
                setStats(response.data.stats);
            }
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    // Fetch latest metrics
    const fetchMetrics = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/v1/metrics/latest?limit=100`);
            if (response.data.success) {
                setMetrics(response.data.data);
            }
            setError(null);
        } catch (err) {
            setError('Failed to fetch metrics');
            console.error('Error fetching metrics:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch latest anomalies
    const fetchAnomalies = async () => {
        try {
            const response = await axios.get(`${API_URL}/api/v1/anomalies/latest?limit=50`);
            if (response.data.success) {
                setAnomalies(response.data.data);
            }
        } catch (err) {
            console.error('Error fetching anomalies:', err);
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchStats();
        fetchMetrics();
        fetchAnomalies();
    }, []);

    // Auto-refresh every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchStats();
            fetchMetrics();
            fetchAnomalies();
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    // Format uptime
    const formatUptime = (seconds) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours}h ${minutes}m ${secs}s`;
    };

    // Get status color
    const getStatusColor = (status) => {
        switch (status) {
            case 'normal': return '#28a745';
            case 'warning': return '#ffc107';
            case 'anomaly': return '#dc3545';
            default: return '#6c757d';
        }
    };

    return (
        <div className="app">
            <header className="header">
                <div className="header-content">
                    <h1>🏭 IoT Infrastructure Monitor</h1>
                    <p className="subtitle">Real-Time Monitoring & Anomaly Detection</p>
                </div>
            </header>

            <main className="main-content">
                {/* KPI Cards */}
                <div className="kpi-grid">
                    <div className="kpi-card">
                        <div className="kpi-icon">📡</div>
                        <div className="kpi-content">
                            <div className="kpi-value">{stats.active_sensors}</div>
                            <div className="kpi-label">Active Sensors</div>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon">⏱️</div>
                        <div className="kpi-content">
                            <div className="kpi-value">{stats.uptime_percentage}%</div>
                            <div className="kpi-label">System Uptime</div>
                            <div className="kpi-sublabel">{formatUptime(stats.system_uptime)}</div>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon">🚨</div>
                        <div className="kpi-content">
                            <div className="kpi-value">{stats.anomalies_detected}</div>
                            <div className="kpi-label">Anomalies Detected</div>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon">🔧</div>
                        <div className="kpi-content">
                            <div className="kpi-value">{stats.total_devices}</div>
                            <div className="kpi-label">Total Devices</div>
                        </div>
                    </div>
                </div>

                {/* Metrics Table */}
                <div className="section">
                    <div className="section-header">
                        <h2>📊 Real-Time Metrics</h2>
                        <div className="refresh-indicator">
                            <span className="pulse"></span>
                            Auto-refreshing every 5s
                        </div>
                    </div>

                    {loading && <div className="loading">Loading metrics...</div>}
                    {error && <div className="error">{error}</div>}

                    {!loading && !error && (
                        <div className="table-container">
                            <table className="metrics-table">
                                <thead>
                                    <tr>
                                        <th>Device ID</th>
                                        <th>Sector</th>
                                        <th>Sensor Type</th>
                                        <th>Value</th>
                                        <th>Quality</th>
                                        <th>Status</th>
                                        <th>Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {metrics.slice(0, 50).map((metric, index) => (
                                        <tr key={index}>
                                            <td className="device-id">{metric.device_id}</td>
                                            <td className="sector">{metric.sector}</td>
                                            <td className="sensor-type">{metric.sensor_type}</td>
                                            <td className="value">
                                                {metric.value} <span className="unit">{metric.unit}</span>
                                            </td>
                                            <td className="quality">
                                                <div className="quality-bar">
                                                    <div
                                                        className="quality-fill"
                                                        style={{ width: `${metric.data_quality_score * 100}%` }}
                                                    ></div>
                                                </div>
                                                <span className="quality-text">
                                                    {(metric.data_quality_score * 100).toFixed(0)}%
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className="status-badge"
                                                    style={{ backgroundColor: getStatusColor(metric.status) }}
                                                >
                                                    {metric.status}
                                                </span>
                                            </td>
                                            <td className="timestamp">
                                                {new Date(metric.timestamp).toLocaleTimeString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Anomalies Section */}
                {anomalies.length > 0 && (
                    <div className="section">
                        <div className="section-header">
                            <h2>⚠️ Recent Anomalies</h2>
                        </div>

                        <div className="anomalies-grid">
                            {anomalies.slice(0, 6).map((anomaly, index) => (
                                <div key={index} className="anomaly-card">
                                    <div className="anomaly-header">
                                        <span className="anomaly-device">{anomaly.device_id}</span>
                                        <span className="anomaly-score">
                                            {(anomaly.anomaly_score * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="anomaly-details">
                                        <div className="anomaly-row">
                                            <span className="label">Sector:</span>
                                            <span className="value">{anomaly.sector}</span>
                                        </div>
                                        <div className="anomaly-row">
                                            <span className="label">Sensor:</span>
                                            <span className="value">{anomaly.sensor_type}</span>
                                        </div>
                                        <div className="anomaly-row">
                                            <span className="label">Value:</span>
                                            <span className="value">{anomaly.current_value} {anomaly.unit}</span>
                                        </div>
                                        <div className="anomaly-row">
                                            <span className="label">Confidence:</span>
                                            <span className="value">{(anomaly.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <div className="anomaly-time">
                                        {new Date(anomaly.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <footer className="footer">
                <p>IoT Infrastructure Monitoring Platform | Real-Time Analytics & ML-Powered Anomaly Detection</p>
            </footer>
        </div>
    );
}

export default App;
