"""
Real-Time IoT Sensor Simulator
Generates realistic sensor data for 100+ devices with fault injection
"""

import os
import time
import json
import random
import math
from datetime import datetime
from typing import Dict, List, Tuple
import paho.mqtt.client as mqtt
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SensorDevice:
    """Represents a single IoT device with multiple sensors"""
    
    SECTORS = ['power', 'water', 'transport', 'telecom', 'industrial']
    
    SENSOR_RANGES = {
        'temperature': {'min': -50, 'max': 150, 'unit': '°C', 'normal_min': 15, 'normal_max': 35},
        'vibration': {'min': 0, 'max': 100, 'unit': 'mm/s', 'normal_min': 0, 'normal_max': 15},
        'pressure': {'min': 0, 'max': 200, 'unit': 'bar', 'normal_min': 80, 'normal_max': 120},
        'humidity': {'min': 0, 'max': 100, 'unit': '%', 'normal_min': 30, 'normal_max': 70}
    }
    
    def __init__(self, device_id: str, sector: str, has_fault: bool = False):
        self.device_id = device_id
        self.sector = sector
        self.has_fault = has_fault
        self.fault_start_time = time.time() if has_fault else None
        self.fault_degradation = 0.0  # Increases over time
        
        # Initialize sensor baselines
        self.baselines = {}
        for sensor_type, ranges in self.SENSOR_RANGES.items():
            self.baselines[sensor_type] = random.uniform(
                ranges['normal_min'], 
                ranges['normal_max']
            )
    
    def generate_reading(self, sensor_type: str) -> Dict:
        """Generate a single sensor reading with optional fault injection"""
        ranges = self.SENSOR_RANGES[sensor_type]
        baseline = self.baselines[sensor_type]
        
        # Normal variation (±5% of baseline)
        variation = baseline * 0.05 * random.uniform(-1, 1)
        value = baseline + variation
        
        # Add sinusoidal pattern for realism
        time_factor = time.time() % 3600  # Hourly cycle
        sine_wave = math.sin(time_factor / 600) * (baseline * 0.1)
        value += sine_wave
        
        # Inject fault if device is faulty
        if self.has_fault:
            elapsed_time = time.time() - self.fault_start_time
            # Fault degrades over time (0 to 1 over 1 hour)
            self.fault_degradation = min(1.0, elapsed_time / 3600)
            
            # Different fault patterns for different sensors
            if sensor_type == 'temperature':
                # Temperature rises gradually
                fault_offset = (ranges['max'] - baseline) * self.fault_degradation * 0.7
                value += fault_offset
            elif sensor_type == 'vibration':
                # Vibration increases with spikes
                fault_offset = ranges['max'] * self.fault_degradation * 0.5
                spike = random.uniform(0, 20) if random.random() > 0.7 else 0
                value += fault_offset + spike
            elif sensor_type == 'pressure':
                # Pressure drops gradually
                fault_offset = baseline * self.fault_degradation * 0.4
                value -= fault_offset
            elif sensor_type == 'humidity':
                # Humidity becomes erratic
                if self.fault_degradation > 0.3:
                    value = random.uniform(ranges['min'], ranges['max'])
        
        # Clamp to valid range
        value = max(ranges['min'], min(ranges['max'], value))
        
        # Calculate data quality score (1.0 = perfect, 0.0 = poor)
        data_quality = 1.0
        if self.has_fault:
            data_quality = max(0.3, 1.0 - (self.fault_degradation * 0.7))
        
        # Add small random noise to quality
        data_quality *= random.uniform(0.95, 1.0)
        
        return {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'device_id': self.device_id,
            'sector': self.sector,
            'sensor_type': sensor_type,
            'value': round(value, 2),
            'unit': ranges['unit'],
            'data_quality_score': round(data_quality, 3),
            'is_faulty': self.has_fault,
            'fault_degradation': round(self.fault_degradation, 3) if self.has_fault else 0.0
        }


class SensorSimulator:
    """Main simulator managing multiple devices"""
    
    def __init__(self):
        self.mqtt_broker = os.getenv('MQTT_BROKER', 'localhost')
        self.mqtt_port = int(os.getenv('MQTT_PORT', 1883))
        self.num_devices = int(os.getenv('NUM_DEVICES', 100))
        self.fault_percentage = int(os.getenv('FAULT_PERCENTAGE', 30))
        self.publish_interval = float(os.getenv('PUBLISH_INTERVAL', 1.0))
        
        self.client = None
        self.devices: List[SensorDevice] = []
        self.connected = False
        
    def on_connect(self, client, userdata, flags, rc):
        """MQTT connection callback"""
        if rc == 0:
            self.connected = True
            logger.info(f"Connected to MQTT broker at {self.mqtt_broker}:{self.mqtt_port}")
        else:
            logger.error(f"Failed to connect to MQTT broker. Return code: {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """MQTT disconnection callback"""
        self.connected = False
        logger.warning(f"Disconnected from MQTT broker. Return code: {rc}")
    
    def on_publish(self, client, userdata, mid):
        """MQTT publish callback"""
        pass  # Silent success
    
    def initialize_devices(self):
        """Create all sensor devices"""
        logger.info(f"Initializing {self.num_devices} devices...")
        
        num_faulty = int(self.num_devices * self.fault_percentage / 100)
        faulty_indices = set(random.sample(range(self.num_devices), num_faulty))
        
        for i in range(self.num_devices):
            device_id = f"device_{i:04d}"
            sector = random.choice(SensorDevice.SECTORS)
            has_fault = i in faulty_indices
            
            device = SensorDevice(device_id, sector, has_fault)
            self.devices.append(device)
        
        logger.info(f"Initialized {self.num_devices} devices ({num_faulty} with faults)")
    
    def connect_mqtt(self):
        """Establish MQTT connection"""
        logger.info(f"Connecting to MQTT broker at {self.mqtt_broker}:{self.mqtt_port}...")
        
        self.client = mqtt.Client(client_id="sensor_simulator")
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_publish = self.on_publish
        
        try:
            self.client.connect(self.mqtt_broker, self.mqtt_port, 60)
            self.client.loop_start()
            
            # Wait for connection
            timeout = 30
            start_time = time.time()
            while not self.connected and (time.time() - start_time) < timeout:
                time.sleep(0.1)
            
            if not self.connected:
                raise Exception("Connection timeout")
                
        except Exception as e:
            logger.error(f"Failed to connect to MQTT broker: {e}")
            raise
    
    def publish_sensor_data(self, device: SensorDevice, sensor_type: str):
        """Publish a single sensor reading to MQTT"""
        reading = device.generate_reading(sensor_type)
        
        # Topic: infrastructure/{sector}/{device_id}/{sensor_type}
        topic = f"infrastructure/{device.sector}/{device.device_id}/{sensor_type}"
        
        payload = json.dumps(reading)
        
        result = self.client.publish(topic, payload, qos=1)
        
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            logger.error(f"Failed to publish to {topic}: {result.rc}")
    
    def run(self):
        """Main simulation loop"""
        logger.info("Starting sensor simulation...")
        
        self.initialize_devices()
        self.connect_mqtt()
        
        logger.info(f"Publishing sensor data every {self.publish_interval} seconds")
        logger.info("Press Ctrl+C to stop")
        
        message_count = 0
        start_time = time.time()
        
        try:
            while True:
                loop_start = time.time()
                
                # Publish data from all devices
                for device in self.devices:
                    for sensor_type in SensorDevice.SENSOR_RANGES.keys():
                        self.publish_sensor_data(device, sensor_type)
                        message_count += 1
                
                # Log statistics every 100 messages
                if message_count % 1000 == 0:
                    elapsed = time.time() - start_time
                    rate = message_count / elapsed if elapsed > 0 else 0
                    logger.info(f"Published {message_count} messages ({rate:.1f} msg/s)")
                
                # Sleep to maintain publish interval
                loop_duration = time.time() - loop_start
                sleep_time = max(0, self.publish_interval - loop_duration)
                time.sleep(sleep_time)
                
        except KeyboardInterrupt:
            logger.info("Shutting down sensor simulator...")
        finally:
            self.client.loop_stop()
            self.client.disconnect()
            
            elapsed = time.time() - start_time
            rate = message_count / elapsed if elapsed > 0 else 0
            logger.info(f"Simulation complete. Published {message_count} messages in {elapsed:.1f}s ({rate:.1f} msg/s)")


if __name__ == "__main__":
    simulator = SensorSimulator()
    simulator.run()
