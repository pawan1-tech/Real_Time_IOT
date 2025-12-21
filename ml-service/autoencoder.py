"""
Autoencoder Model for Spatial Anomaly Detection
Detects anomalies based on reconstruction error
"""

import torch
import torch.nn as nn


class Autoencoder(nn.Module):
    """
    Autoencoder for spatial anomaly detection
    Architecture: 30 -> 16 -> 8 -> 4 (bottleneck) -> 8 -> 16 -> 30
    """
    
    def __init__(self, input_dim=30):
        super(Autoencoder, self).__init__()
        
        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 16),
            nn.ReLU(),
            nn.Linear(16, 8),
            nn.ReLU(),
            nn.Linear(8, 4),
            nn.ReLU()
        )
        
        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(4, 8),
            nn.ReLU(),
            nn.Linear(8, 16),
            nn.ReLU(),
            nn.Linear(16, input_dim),
            nn.Sigmoid()  # Output between 0 and 1
        )
    
    def forward(self, x):
        encoded = self.encoder(x)
        decoded = self.decoder(encoded)
        return decoded
    
    def get_reconstruction_error(self, x):
        """Calculate reconstruction error (MSE)"""
        with torch.no_grad():
            reconstructed = self.forward(x)
            error = torch.mean((x - reconstructed) ** 2, dim=1)
        return error.numpy()


def create_autoencoder(input_dim=30):
    """Factory function to create autoencoder"""
    return Autoencoder(input_dim)
