"""
Model Training Script
Trains Autoencoder and LSTM models on collected sensor data
"""

import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import logging

from autoencoder import create_autoencoder
from lstm import create_lstm
from hybrid_ensemble import create_ensemble

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SensorDataset(Dataset):
    """Dataset for sensor sequences"""
    
    def __init__(self, sequences, labels=None):
        self.sequences = torch.FloatTensor(sequences)
        self.labels = labels
    
    def __len__(self):
        return len(self.sequences)
    
    def __getitem__(self, idx):
        if self.labels is not None:
            return self.sequences[idx], self.labels[idx]
        return self.sequences[idx]


def generate_synthetic_data(num_samples=10000, sequence_length=30):
    """
    Generate synthetic sensor data for training
    In production, this would load from GridDB
    """
    logger.info(f"Generating {num_samples} synthetic sequences...")
    
    sequences = []
    labels = []
    
    for i in range(num_samples):
        # Normal data (80%)
        if np.random.random() > 0.2:
            # Generate normal sequence with sinusoidal pattern
            t = np.linspace(0, 4*np.pi, sequence_length)
            base = np.sin(t) + np.random.normal(0, 0.1, sequence_length)
            sequences.append(base)
            labels.append(0)  # Normal
        else:
            # Anomalous data (20%)
            t = np.linspace(0, 4*np.pi, sequence_length)
            base = np.sin(t)
            # Add anomaly (spike, drift, or noise)
            anomaly_type = np.random.choice(['spike', 'drift', 'noise'])
            if anomaly_type == 'spike':
                spike_pos = np.random.randint(10, sequence_length-10)
                base[spike_pos:spike_pos+5] += np.random.uniform(2, 4)
            elif anomaly_type == 'drift':
                base += np.linspace(0, 2, sequence_length)
            else:
                base += np.random.normal(0, 0.5, sequence_length)
            
            sequences.append(base)
            labels.append(1)  # Anomaly
    
    return np.array(sequences), np.array(labels)


def train_autoencoder(model, train_loader, val_loader, epochs=50, lr=0.001):
    """Train autoencoder model"""
    logger.info("Training Autoencoder...")
    
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    
    best_val_loss = float('inf')
    
    for epoch in range(epochs):
        # Training
        model.train()
        train_loss = 0
        for batch in train_loader:
            if isinstance(batch, list):
                batch = batch[0]
            
            optimizer.zero_grad()
            reconstructed = model(batch)
            loss = criterion(reconstructed, batch)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
        
        train_loss /= len(train_loader)
        
        # Validation
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for batch in val_loader:
                if isinstance(batch, list):
                    batch = batch[0]
                reconstructed = model(batch)
                loss = criterion(reconstructed, batch)
                val_loss += loss.item()
        
        val_loss /= len(val_loader)
        
        if val_loss < best_val_loss:
            best_val_loss = val_loss
        
        if (epoch + 1) % 10 == 0:
            logger.info(f"Epoch {epoch+1}/{epochs} - Train Loss: {train_loss:.6f}, Val Loss: {val_loss:.6f}")
    
    logger.info(f"Autoencoder training complete. Best val loss: {best_val_loss:.6f}")
    return model


def train_lstm(model, train_loader, val_loader, epochs=50, lr=0.001):
    """Train LSTM model"""
    logger.info("Training LSTM...")
    
    criterion = nn.L1Loss()  # MAE
    optimizer = optim.Adam(model.parameters(), lr=lr)
    
    best_val_loss = float('inf')
    
    for epoch in range(epochs):
        # Training
        model.train()
        train_loss = 0
        for batch in train_loader:
            if isinstance(batch, list):
                batch = batch[0]
            
            # Use first 29 to predict 30th
            x = batch[:, :-1].unsqueeze(-1)  # (batch, 29, 1)
            y = batch[:, -1].unsqueeze(-1)   # (batch, 1)
            
            optimizer.zero_grad()
            pred = model(x)
            loss = criterion(pred, y)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
        
        train_loss /= len(train_loader)
        
        # Validation
        model.eval()
        val_loss = 0
        with torch.no_grad():
            for batch in val_loader:
                if isinstance(batch, list):
                    batch = batch[0]
                x = batch[:, :-1].unsqueeze(-1)
                y = batch[:, -1].unsqueeze(-1)
                pred = model(x)
                loss = criterion(pred, y)
                val_loss += loss.item()
        
        val_loss /= len(val_loader)
        
        if val_loss < best_val_loss:
            best_val_loss = val_loss
        
        if (epoch + 1) % 10 == 0:
            logger.info(f"Epoch {epoch+1}/{epochs} - Train Loss: {train_loss:.6f}, Val Loss: {val_loss:.6f}")
    
    logger.info(f"LSTM training complete. Best val loss: {best_val_loss:.6f}")
    return model


def main():
    """Main training pipeline"""
    logger.info("=== Model Training Pipeline ===")
    
    # Generate synthetic data
    sequences, labels = generate_synthetic_data(num_samples=10000)
    
    # Normalize
    scaler = StandardScaler()
    sequences_normalized = scaler.fit_transform(sequences)
    
    # Split data
    X_train, X_val, y_train, y_val = train_test_split(
        sequences_normalized, labels, test_size=0.2, random_state=42
    )
    
    logger.info(f"Training samples: {len(X_train)}, Validation samples: {len(X_val)}")
    
    # Create datasets
    train_dataset = SensorDataset(X_train, y_train)
    val_dataset = SensorDataset(X_val, y_val)
    
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
    
    # Train Autoencoder
    autoencoder = create_autoencoder(input_dim=30)
    autoencoder = train_autoencoder(autoencoder, train_loader, val_loader, epochs=50)
    
    # Train LSTM
    lstm = create_lstm(input_size=1, hidden_size=32, num_layers=2, dropout=0.2)
    lstm = train_lstm(lstm, train_loader, val_loader, epochs=50)
    
    # Save models
    os.makedirs('models', exist_ok=True)
    torch.save(autoencoder.state_dict(), 'models/autoencoder.pt')
    torch.save(lstm.state_dict(), 'models/lstm.pt')
    logger.info("Models saved to models/ directory")
    
    # Create ensemble and calibrate
    ensemble = create_ensemble(autoencoder, lstm)
    
    # Calculate errors on training data for calibration
    logger.info("Calibrating ensemble thresholds...")
    ae_errors = []
    lstm_errors = []
    
    with torch.no_grad():
        for batch in train_loader:
            if isinstance(batch, list):
                batch = batch[0]
            
            # Autoencoder errors
            ae_err = autoencoder.get_reconstruction_error(batch)
            ae_errors.extend(ae_err.tolist())
            
            # LSTM errors
            x = batch[:, :-1].unsqueeze(-1)
            y = batch[:, -1].unsqueeze(-1)
            lstm_err = lstm.get_prediction_error(x, y)
            lstm_errors.extend(lstm_err.tolist())
    
    ensemble.calibrate_thresholds(np.array(ae_errors), np.array(lstm_errors), percentile=95)
    logger.info(f"Calibrated thresholds - AE: {ensemble.ae_threshold:.4f}, LSTM: {ensemble.lstm_threshold:.4f}")
    
    # Evaluate on validation set
    logger.info("Evaluating on validation set...")
    correct = 0
    total = 0
    
    for i in range(len(X_val)):
        result = ensemble.predict(X_val[i])
        predicted = 1 if result['is_anomaly'] else 0
        if predicted == y_val[i]:
            correct += 1
        total += 1
    
    accuracy = correct / total
    logger.info(f"Validation Accuracy: {accuracy*100:.2f}%")
    
    logger.info("=== Training Complete ===")


if __name__ == '__main__':
    main()
