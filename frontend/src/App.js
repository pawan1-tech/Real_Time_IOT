import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import MockDataGenerator from './services/MockDataGenerator';
import './App.css';

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
    const [isDemoMode, setIsDemoMode] = useState(false);

    // Initial check to see if backend is available
    useEffect(() => {
        const checkBackend = async () => {
            try {
                await axios.get(`${API_URL}/api/v1/stats`, { timeout: 2000 });
                setIsDemoMode(false);
            } catch (err) {
                console.log("Backend not reachable, switching to Demo Mode");
                setIsDemoMode(true);
            }
        };
        checkBackend();
    }, []);

    const fetchData = useCallback(async () => {
        if (isDemoMode) {
            // Use Mock Data
            setStats(MockDataGenerator.getStats());
            setMetrics(MockDataGenerator.getMetrics(100)); // 100 devices
            setAnomalies(MockDataGenerator.getAnomalies());
            setLoading(false);
            setError(null);
        } else {
            // Use Real API
            try {
                const [statsRes, metricsRes, anomaliesRes] = await Promise.all([
                    axios.get(`${API_URL}/api/v1/stats`),
                    axios.get(`${API_URL}/api/v1/metrics/latest?limit=100`),
                    axios.get(`${API_URL}/api/v1/anomalies/latest?limit=50`)
                ]);

                if (statsRes.data.success) setStats(statsRes.data.stats);
                if (metricsRes.data.success) setMetrics(metricsRes.data.data);
                if (anomaliesRes.data.success) setAnomalies(anomaliesRes.data.data);

                setError(null);
            } catch (err) {
                console.error('API Error:', err);
                // Optional: Auto-switch to demo mode on failure? 
                // For now just show error or maybe prompt user
                setError('Failed to fetch data from backend. Try switching to Demo Mode.');
            } finally {
                setLoading(false);
            }
        }
    }, [isDemoMode]);

    // Initial fetch
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Auto-refresh every 5 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            fetchData();
        }, 5000);
        return () => clearInterval(interval);
    }, [fetchData]);

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
            case 'normal': return '#10b981'; // Green
            case 'warning': return '#f59e0b'; // Amber
            case 'anomaly': return '#ef4444'; // Red
            default: return '#64748b';
        }
    };

    return (
        <div className="app">
            <header className="header">
                <div className="header-content">
                    <h1>🏭 IoT Infrastructure Monitor</h1>
                    <p className="subtitle">Real-Time Monitoring & Anomaly Detection</p>
                </div>
                <div className="demo-controls">
                    {isDemoMode && <span className="demo-badge">DEMO MODE ACTIVE</span>}
                    <button
                        className="btn-demo"
                        onClick={() => setIsDemoMode(!isDemoMode)}
                    >
                        {isDemoMode ? 'Switch to Live API' : 'Switch to Demo Mode'}
                    </button>
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
                            <div className="kpi-sublabel">Across {stats.total_devices} Devices</div>
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
                            <div className="kpi-sublabel">Last 24 Hours</div>
                        </div>
                    </div>

                    <div className="kpi-card">
                        <div className="kpi-icon">🔧</div>
                        <div className="kpi-content">
                            <div className="kpi-value">{stats.total_devices}</div>
                            <div className="kpi-label">Total Devices</div>
                            <div className="kpi-sublabel">Connected & Online</div>
                        </div>
                    </div>
                </div>

                {/* Metrics Table */}
                <div className="section">
                    <div className="section-header">
                        <h2>📊 Real-Time Metrics</h2>
                        <div className="refresh-indicator">
                            <span className="pulse"></span>
                            Live Updates (5s)
                        </div>
                    </div>

                    {loading && <div className="loading">Loading metrics...</div>}
                    {!loading && error && !isDemoMode && <div className="error">{error}</div>}

                    {!loading && (!error || isDemoMode) && (
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
                                    {metrics.map((metric, index) => (
                                        <tr key={index}>
                                            <td><span className="device-id">{metric.device_id}</span></td>
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
                                                    style={{
                                                        backgroundColor: getStatusColor(metric.status),
                                                        boxShadow: `0 0 10px ${getStatusColor(metric.status)}40`
                                                    }}
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
                            {anomalies.map((anomaly, index) => (
                                <div key={index} className="anomaly-card">
                                    <div className="anomaly-header">
                                        <span className="anomaly-device">{anomaly.device_id}</span>
                                        <span className="anomaly-score">
                                            {(anomaly.anomaly_score * 100).toFixed(0)}% Score
                                        </span>
                                    </div>
                                    <div className="anomaly-details">
                                        <div className="anomaly-row">
                                            <span className="label">Sector</span>
                                            <span className="value">{anomaly.sector}</span>
                                        </div>
                                        <div className="anomaly-row">
                                            <span className="label">Sensor</span>
                                            <span className="value">{anomaly.sensor_type}</span>
                                        </div>
                                        <div className="anomaly-row">
                                            <span className="label">Observed Value</span>
                                            <span className="value">{anomaly.current_value} {anomaly.unit}</span>
                                        </div>
                                        <div className="anomaly-row">
                                            <span className="label">Model Confidence</span>
                                            <span className="value">{(anomaly.confidence * 100).toFixed(0)}%</span>
                                        </div>
                                    </div>
                                    <div className="anomaly-time">
                                        Detected at {new Date(anomaly.timestamp).toLocaleTimeString()}
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
