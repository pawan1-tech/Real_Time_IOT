"""
Hybrid Ensemble Model
Combines Autoencoder and LSTM predictions
"""

import torch
import numpy as np
from sklearn.preprocessing import StandardScaler


class HybridEnsemble:
    """
    Ensemble model combining Autoencoder and LSTM
    Uses weighted voting for final anomaly decision
    """
    
    def __init__(self, autoencoder, lstm, ae_weight=0.5, lstm_weight=0.5, threshold=0.5):
        self.autoencoder = autoencoder
        self.lstm = lstm
        self.ae_weight = ae_weight
        self.lstm_weight = lstm_weight
        self.threshold = threshold
        
        # Scalers for normalization
        self.ae_scaler = StandardScaler()
        self.lstm_scaler = StandardScaler()
        
        # Thresholds (will be calibrated during training)
        self.ae_threshold = 0.1
        self.lstm_threshold = 0.1
    
    def calibrate_thresholds(self, ae_errors, lstm_errors, percentile=95):
        """
        Calibrate thresholds based on training data
        Use 95th percentile as threshold
        """
        self.ae_threshold = np.percentile(ae_errors, percentile)
        self.lstm_threshold = np.percentile(lstm_errors, percentile)
    
    def normalize_score(self, error, threshold):
        """Normalize error to 0-1 score"""
        if threshold == 0:
            return 0.0
        score = min(1.0, error / threshold)
        return score
    
    def predict(self, sequence):
        """
        Predict anomaly for a sequence
        
        Args:
            sequence: numpy array of shape (30,) - normalized sensor values
            
        Returns:
            dict with prediction results
        """
        start_time = torch.cuda.Event(enable_timing=True) if torch.cuda.is_available() else None
        end_time = torch.cuda.Event(enable_timing=True) if torch.cuda.is_available() else None
        
        if start_time:
            start_time.record()
        
        # Prepare data
        sequence_tensor = torch.FloatTensor(sequence).unsqueeze(0)  # (1, 30)
        
        # Autoencoder prediction
        ae_error = self.autoencoder.get_reconstruction_error(sequence_tensor)[0]
        ae_score = self.normalize_score(ae_error, self.ae_threshold)
        
        # LSTM prediction (use first 29 to predict 30th)
        lstm_input = sequence_tensor[:, :-1].unsqueeze(-1)  # (1, 29, 1)
        lstm_target = torch.FloatTensor([[sequence[-1]]])  # (1, 1)
        lstm_error = self.lstm.get_prediction_error(lstm_input, lstm_target)[0]
        lstm_score = self.normalize_score(lstm_error, self.lstm_threshold)
        
        # Ensemble score (weighted average)
        ensemble_score = (self.ae_weight * ae_score) + (self.lstm_weight * lstm_score)
        
        # Anomaly decision
        is_anomaly = ensemble_score > self.threshold
        
        # Calculate confidence
        confidence = abs(ensemble_score - self.threshold) / self.threshold
        confidence = min(1.0, confidence)
        
        if end_time:
            end_time.record()
            torch.cuda.synchronize()
            inference_time = start_time.elapsed_time(end_time)
        else:
            inference_time = 0
        
        return {
            'is_anomaly': bool(is_anomaly),
            'anomaly_score': float(ensemble_score),
            'confidence': float(confidence),
            'ae_score': float(ae_score),
            'lstm_score': float(lstm_score),
            'ae_error': float(ae_error),
            'lstm_error': float(lstm_error),
            'inference_time_ms': float(inference_time) if inference_time else 0
        }
    
    def predict_batch(self, sequences):
        """
        Predict anomalies for a batch of sequences
        
        Args:
            sequences: numpy array of shape (batch_size, 30)
            
        Returns:
            list of prediction dicts
        """
        results = []
        for sequence in sequences:
            result = self.predict(sequence)
            results.append(result)
        return results


def create_ensemble(autoencoder, lstm, ae_weight=0.5, lstm_weight=0.5, threshold=0.5):
    """Factory function to create ensemble"""
    return HybridEnsemble(autoencoder, lstm, ae_weight, lstm_weight, threshold)
