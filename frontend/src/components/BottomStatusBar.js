import React from 'react';
import { CheckCircle, Clock, MapPin, Activity } from 'lucide-react';

const BottomStatusBar = () => {
    return (
        <div className="bottom-status-bar">
            <div className="status-item">
                <span className="status-label">Last Update:</span>
                <span className="status-value">2s ago</span>
            </div>

            <div className="status-pill">
                <CheckCircle size={14} className="status-icon" />
                <span>Throughput: 48K msg/s</span>
            </div>

            <div className="status-pill">
                <Activity size={14} className="status-icon" />
                <span>Latency: 73ms</span>
            </div>

            <div className="status-pill">
                <MapPin size={14} className="status-icon" />
                <span>Latency: 73ms</span>
            </div>

            <div className="ml-auto status-item">
                <span>Active Sensors: </span>
                <span className="text-white font-bold">1,247</span>
            </div>
        </div>
    );
};

export default BottomStatusBar;
