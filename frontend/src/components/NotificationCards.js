
import React from 'react';
import { Mail, MessageSquare, AlertCircle } from 'lucide-react';

const NotificationCards = () => {
    return (
        <div className="notification-cards">
            {/* Email Card */}
            <div className="notif-card dark-card">
                <div className="notif-header">
                    <div className="icon-badge red"><Mail size={16} /></div>
                    <span>Subject:</span>
                    <div className="bell-icon"><AlertCircle size={14} /></div>
                </div>
                <h3>CRITICAL - Substation Temperature High</h3>
                <div className="dots-pattern"></div>
            </div>

            {/* Slack Card */}
            <div className="notif-card dark-card">
                <div className="notif-header">
                    <div className="icon-badge red"><MessageSquare size={16} /></div>
                    <span>Slack</span>
                    <div className="bell-icon"><AlertCircle size={14} /></div>
                </div>
                <div className="slack-list">
                    <div className="slack-item active">
                        <div className="avatar">😊</div>
                        <div className="slack-content">
                            <div className="slack-name">Muss.ease</div>
                            <div className="slack-msg">normal</div>
                        </div>
                    </div>
                    <div className="slack-item">
                        <div className="avatar">😎</div>
                        <div className="slack-content">
                            <div className="slack-name">Urgent tone</div>
                            <div className="slack-msg">urgent</div>
                        </div>
                    </div>
                    <div className="slack-item success">
                        <div className="avatar">✅</div>
                        <div className="slack-content">
                            <div className="slack-name">Resolved</div>
                            <div className="slack-msg">urgent</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Jira Card */}
            <div className="notif-card dark-card">
                <div className="notif-header">
                    <div className="icon-badge red"><AlertCircle size={16} /></div>
                    <span>Alark</span>
                    <div className="ml-auto">=</div>
                </div>
                <h3>Time-to failure</h3>
                <div className="jira-box">
                    <div className="jira-header">
                        <span>JIRA Ticket</span>
                        <span>v</span>
                    </div>
                    <p className="jira-text">
                        Preporstes to remprested or ripust raritch and emrperted are namtim estimated time...
                    </p>
                </div>
            </div>
        </div>
    );
};

export default NotificationCards;
