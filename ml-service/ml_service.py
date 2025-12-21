"""
ML Service - Real-time Anomaly Detection
Consumes processed sensor data, buffers sequences, and runs ML inference
"""

import os
import json
import time
import logging
from collections import defaultdict, deque
from kafka import KafkaConsumer, KafkaProducer
import torch
import numpy as np
from sklearn.preprocessing import StandardScaler

from autoencoder import create_autoencoder
from lstm import create_lstm
from hybrid_ensemble import create_ensemble

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MLService:
    """Real-time ML inference service"""
    
    def __init__(self):
        # Kafka configuration
        self.kafka_broker = os.getenv('KAFKA_BROKER', 'localhost:9092')
        self.input_topic = 'infrastructure-sensor-processed'
        self.output_topic = 'infrastructure-anomalies'
        
        # ML configuration
        self.sequence_length = 30
        self.batch_size = int(os.getenv('INFERENCE_BATCH_SIZE', '10'))
        
        # Device buffers: {device_id: {sensor_type: deque}}
        self.buffers = defaultdict(lambda: defaultdict(lambda: deque(maxlen=self.sequence_length)))
        
        # Scalers per sensor type
        self.scalers = {
            'temperature': StandardScaler(),
            'vibration': StandardScaler(),
            'pressure': StandardScaler(),
            'humidity': StandardScaler()
        }
        
        # Fit scalers with expected ranges
        self._init_scalers()
        
        # Load models
        self.ensemble = None
        self._load_models()
        
        # Kafka clients
        self.consumer = None
        self.producer = None
        
        # Statistics
        self.stats = {
            'messages_consumed': 0,
            'predictions_made': 0,
            'anomalies_detected': 0,
            'start_time': time.time()
        }
    
    def _init_scalers(self):
        """Initialize scalers with expected value ranges"""
        # Fit scalers with typical ranges
        ranges = {
            'temperature': np.array([[-50], [150]]),
            'vibration': np.array([[0], [100]]),
            'pressure': np.array([[0], [200]]),
            'humidity': np.array([[0], [100]])
        }
        
        for sensor_type, data in ranges.items():
            self.scalers[sensor_type].fit(data)
    
    def _load_models(self):
        """Load or create ML models"""
        logger.info('Loading ML models...')
        
        model_path = os.getenv('MODEL_PATH', '/app/models')
        
        # Create models
        autoencoder = create_autoencoder(input_dim=30)
        lstm = create_lstm(input_size=1, hidden_size=32, num_layers=2, dropout=0.2)
        
        # Try to load pre-trained weights
        ae_path = os.path.join(model_path, 'autoencoder.pt')
        lstm_path = os.path.join(model_path, 'lstm.pt')
        
        if os.path.exists(ae_path):
            autoencoder.load_state_dict(torch.load(ae_path, map_location='cpu'))
            logger.info('Loaded pre-trained autoencoder')
        else:
            logger.warning('No pre-trained autoencoder found, using random weights')
        
        if os.path.exists(lstm_path):
            lstm.load_state_dict(torch.load(lstm_path, map_location='cpu'))
            logger.info('Loaded pre-trained LSTM')
        else:
            logger.warning('No pre-trained LSTM found, using random weights')
        
        # Set to evaluation mode
        autoencoder.eval()
        lstm.eval()
        
        # Create ensemble
        self.ensemble = create_ensemble(
            autoencoder=autoencoder,
            lstm=lstm,
            ae_weight=0.5,
            lstm_weight=0.5,
            threshold=0.5
        )
        
        logger.info('ML models ready')
    
    def init_kafka(self):
        """Initialize Kafka consumer and producer"""
        logger.info(f'Connecting to Kafka at {self.kafka_broker}...')
        
        self.consumer = KafkaConsumer(
            self.input_topic,
            bootstrap_servers=[self.kafka_broker],
            group_id='ml-service',
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            enable_auto_commit=True,
            max_poll_records=500
        )
        
        self.producer = KafkaProducer(
            bootstrap_servers=[self.kafka_broker],
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        
        logger.info('Kafka connected')
    
    def process_message(self, data):
        """Process a single sensor reading"""
        device_id = data['device_id']
        sensor_type = data['sensor_type']
        value = data['value']
        
        # Normalize value
        scaler = self.scalers.get(sensor_type)
        if scaler:
            normalized_value = scaler.transform([[value]])[0][0]
        else:
            normalized_value = value
        
        # Add to buffer
        self.buffers[device_id][sensor_type].append(normalized_value)
        
        # Check if buffer is full
        if len(self.buffers[device_id][sensor_type]) == self.sequence_length:
            # Run inference
            sequence = np.array(list(self.buffers[device_id][sensor_type]))
            result = self.ensemble.predict(sequence)
            
            # Create anomaly message
            anomaly_data = {
                'timestamp': data['timestamp'],
                'device_id': device_id,
                'sector': data['sector'],
                'sensor_type': sensor_type,
                'current_value': value,
                'unit': data.get('unit', ''),
                'is_anomaly': result['is_anomaly'],
                'anomaly_score': result['anomaly_score'],
                'confidence': result['confidence'],
                'ae_score': result['ae_score'],
                'lstm_score': result['lstm_score'],
                'inference_time_ms': result['inference_time_ms']
            }
            
            # Publish to Kafka
            self.producer.send(self.output_topic, value=anomaly_data)
            
            self.stats['predictions_made'] += 1
            if result['is_anomaly']:
                self.stats['anomalies_detected'] += 1
            
            return anomaly_data
        
        return None
    
    def run(self):
        """Main service loop"""
        logger.info('Starting ML service...')
        
        self.init_kafka()
        
        logger.info(f'Consuming from {self.input_topic}')
        logger.info(f'Publishing to {self.output_topic}')
        logger.info('ML service running')
        
        last_stats_time = time.time()
        
        try:
            for message in self.consumer:
                data = message.value
                self.stats['messages_consumed'] += 1
                
                # Process message
                self.process_message(data)
                
                # Log statistics every 10 seconds
                if time.time() - last_stats_time > 10:
                    self.log_stats()
                    last_stats_time = time.time()
                    
        except KeyboardInterrupt:
            logger.info('Shutting down ML service...')
        finally:
            self.consumer.close()
            self.producer.close()
            self.log_stats()
    
    def log_stats(self):
        """Log service statistics"""
        uptime = time.time() - self.stats['start_time']
        throughput = self.stats['predictions_made'] / uptime if uptime > 0 else 0
        
        logger.info(f"Stats: Consumed={self.stats['messages_consumed']}, "
                   f"Predictions={self.stats['predictions_made']}, "
                   f"Anomalies={self.stats['anomalies_detected']}, "
                   f"Throughput={throughput:.1f} pred/s")


if __name__ == '__main__':
    service = MLService()
    service.run()
