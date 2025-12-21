# Models Directory

This directory will contain trained ML model weights:
- `autoencoder.pt` - Trained autoencoder model
- `lstm.pt` - Trained LSTM model

## Training Models

To train the models, run:

```bash
cd ml-service
python train_models.py
```

This will generate synthetic training data and save the trained models to this directory.

## Using Pre-trained Models

If you have pre-trained models, place them in this directory with the names:
- `autoencoder.pt`
- `lstm.pt`

The ML service will automatically load them on startup.

## Model Architecture

### Autoencoder
- Input: 30 sensor readings
- Architecture: 30 → 16 → 8 → 4 (bottleneck) → 8 → 16 → 30
- Output: Reconstruction error (spatial anomalies)

### LSTM
- Input: 29 sensor readings
- Architecture: 2-layer LSTM (32 hidden units, dropout 0.2)
- Output: Prediction error for 30th value (temporal anomalies)

### Ensemble
- Combines both models with 50% weight each
- Threshold calibrated at 95th percentile
- Target accuracy: 97.5%
