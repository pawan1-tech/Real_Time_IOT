"""
LSTM Model for Temporal Anomaly Detection
Predicts next value based on sequence history
"""

import torch
import torch.nn as nn


class LSTMPredictor(nn.Module):
    """
    LSTM for temporal anomaly detection
    Predicts the 30th value from the first 29 values
    """
    
    def __init__(self, input_size=1, hidden_size=32, num_layers=2, dropout=0.2):
        super(LSTMPredictor, self).__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout,
            batch_first=True
        )
        
        self.fc = nn.Linear(hidden_size, 1)
    
    def forward(self, x):
        # x shape: (batch, seq_len, input_size)
        lstm_out, _ = self.lstm(x)
        
        # Take the last output
        last_output = lstm_out[:, -1, :]
        
        # Predict next value
        prediction = self.fc(last_output)
        
        return prediction
    
    def get_prediction_error(self, x, y_true):
        """Calculate prediction error (MAE)"""
        with torch.no_grad():
            y_pred = self.forward(x)
            error = torch.abs(y_true - y_pred).squeeze()
        return error.numpy()


def create_lstm(input_size=1, hidden_size=32, num_layers=2, dropout=0.2):
    """Factory function to create LSTM"""
    return LSTMPredictor(input_size, hidden_size, num_layers, dropout)
