import React from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        if (data.isAnomaly) {
            return (
                <div className="custom-tooltip anomaly-tooltip">
                    <p className="tooltip-label">🔴 Anomaly Detected</p>
                    <p className="tooltip-desc">{data.confidence}% Confidence</p>
                    <p className="tooltip-value">Value: {data.value}</p>
                </div>
            );
        }
        return (
            <div className="custom-tooltip">
                <p className="tooltip-label">Normal Operation</p>
                <p className="tooltip-value">Value: {payload[0].value}</p>
            </div>
        );
    }
    return null;
};

// Generate deterministic mock history data for the chart
const generateChartData = () => {
    const data = [];
    let value = 200;
    for (let i = 0; i < 60; i++) {
        const isAnomaly = i === 45; // Fixed anomaly point
        // Random walk
        const change = (Math.random() - 0.5) * 50;
        value = Math.max(100, Math.min(900, value + change));

        // Spike for anomaly
        if (isAnomaly) value = 850;

        data.push({
            time: i * 100,
            value: Math.floor(value),
            isAnomaly,
            confidence: isAnomaly ? 97.5 : 0
        });
    }
    return data;
};

const MainChart = () => {
    const data = generateChartData();

    return (
        <div className="main-chart-container">
            <div className="chart-header">
                <h2>Real-Time Dashboard: From Sensors to Actionable Insights</h2>
                <div className="chart-meta">
                    <span className="meta-item active">Time</span>
                    <span className="meta-item">Sensor</span>
                    <span className="meta-item">Power</span>
                    <span className="meta-item">Calendar</span>
                    <div className="resolution">1920x1280</div>
                </div>
            </div>
            <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#e2e8f0" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} domain={[0, 1000]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#ef4444"
                            strokeWidth={3}
                            dot={(props) => {
                                const { cx, cy, payload } = props;
                                if (payload.isAnomaly) {
                                    return (
                                        <svg x={cx - 5} y={cy - 5} width={10} height={10} fill="#ef4444" viewBox="0 0 1024 1024">
                                            <circle cx="512" cy="512" r="512" />
                                        </svg>
                                    );
                                }
                                return null;
                            }}
                            activeDot={{ r: 8 }}
                        />
                        {/* Secondary faint line for aesthetic depth */}
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#3b82f6"
                            strokeWidth={1}
                            strokeOpacity={0.5}
                            data={data.map(d => ({ ...d, value: d.value * 0.8 }))}
                            dot={false}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default MainChart;
