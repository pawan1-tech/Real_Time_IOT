FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy simulator code
COPY simulate_sensors.py .

# Run the simulator
CMD ["python", "-u", "simulate_sensors.py"]
