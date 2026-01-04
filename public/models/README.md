# Vosk Speech Recognition Model

This directory should contain the Vosk speech recognition model file.

## Current Model

**Indian English Model** (`vosk-model-small-en-in-0.4.zip`, ~36MB)
- Optimized for Indian English accents
- Better accuracy for phrases like "BST", "recursive hashmap", etc.
- Good balance between accuracy and size
- Still supports real-time streaming recognition

## Download Instructions

The model file is not included in the repository due to size.

To download the current model:

```bash
# From the project root
mkdir -p public/models
curl -L -o public/models/vosk-model-small-en-in-0.4.zip \
  "https://alphacephei.com/vosk/models/vosk-model-small-en-in-0.4.zip"
```

Or download manually from:
- https://alphacephei.com/vosk/models/vosk-model-small-en-in-0.4.zip

The model will be served from `/models/vosk-model-small-en-in-0.4.zip` when the app runs.

## Alternative Models

You can use other Vosk models if needed. Update `VOSK_MODEL_URL` in `src/services/voskSpeechRecognition.js`:

### Indian English Models (Recommended for Indian accents)
- `vosk-model-small-en-in-0.4` (36MB) - **Current**, optimized for Indian English
- `vosk-model-en-in-0.4` (1.5GB) - Larger, more accurate Indian English model

### American English Models
- `vosk-model-small-en-us-0.15` (40MB) - Small, general American English
- `vosk-model-en-us-0.22` (1.8GB) - Large, very accurate American English
- `vosk-model-en-us-0.22-lgraph` (128MB) - Medium size, good balance

### Multilingual Models
- `vosk-model-small-en-in-0.4` - Supports Indian English
- `vosk-model-en-us-0.22` - Supports American English

## Grammar/Keyword Bias

The code includes DSA-specific keyword bias to improve recognition of technical terms like:
- Data structures: array, hashmap, BST, tree, heap, graph, etc.
- Algorithms: recursive, iteration, traversal, sorting, etc.
- Common terms: pointer, index, variable, function, etc.

This is automatically enabled when using the Indian English model.

