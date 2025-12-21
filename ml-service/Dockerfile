FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ML code
COPY *.py ./

# Create models directory
RUN mkdir -p /app/models

# Run the service
CMD ["python", "-u", "ml_service.py"]
