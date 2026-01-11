import React from 'react';
import { Bell, Hexagon } from 'lucide-react';

const RightSidebar = () => {
    return (
        <div className="right-sidebar">
            <div className="calendar-widget">
                <div className="cal-header">
                    <span>Predictive Maintenance</span>
                    <span>v</span>
                </div>
                <div className="cal-days">
                    <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                </div>
                <div className="cal-grid">
                    <span className="dim">29</span><span className="dim">30</span><span className="dim">1</span><span className="dim">2</span><span className="dim">3</span><span className="dim">4</span><span className="red">5</span>
                    <span>6</span><span>7</span><span className="circle green">8</span><span className="circle red">9</span><span className="circle green">10</span><span className="circle yellow">11</span>
                    <span>12</span><span>13</span><span className="circle red">14</span><span className="circle red">15</span><span>16</span><span>17</span><span>18</span><span>19</span>
                    <span>20</span><span>21</span><span>22</span><span>23</span><span>24</span><span>25</span><span>26</span>
                </div>
            </div>

            <div className="status-card red-gradient">
                <div className="card-info">
                    <h3>Active Alerts:</h3>
                    <div className="card-value">3</div>
                </div>
                <div className="card-icon"><Hexagon /></div>
            </div>

            <div className="status-card green-gradient">
                <div className="card-info">
                    <h3>System Uptime:</h3>
                    <div className="card-value">99.92%</div>
                </div>
                <div className="card-icon"><Hexagon /></div>
            </div>

            <div className="status-card yellow-gradient">
                <div className="card-info">
                    <h3>Equipment RUL:</h3>
                    <div className="card-value small">48h <span className="tag-red">SOUM</span> <span className="tag-dark">1000D</span></div>
                </div>
            </div>

            <div className="status-card white-card">
                <div className="card-info">
                    <h3>Cost Savings YTD:</h3>
                    <div className="card-value text-dark">$2.1M <span className="arrow-up">↑</span></div>
                </div>
            </div>
        </div>
    );
};

export default RightSidebar;
