# Dry Runner - Voice-Controlled DSA Visualization

## Overview

Dry Runner is a voice-controlled visualization tool for data structures and algorithms. It uses AI to understand natural language descriptions and automatically draws professional diagrams using React Flow.

## Features

### ✅ Voice Input
- Real-time speech recognition using Web Speech API
- Continuous listening mode
- Start/Stop controls
- Visual feedback for active listening

### ✅ Professional Diagramming
- Uses **React Flow** for a polished, professional look (similar to Lucid, Draw.io, Eraser.io)
- Custom node types for:
  - HashMaps (with key-value pairs)
  - Arrays (with elements)
  - Heaps (min/max)
  - Trees (binary tree nodes)
  - Variables
- Interactive canvas with:
  - Zoom and pan controls
  - Mini-map for navigation
  - Drag-and-drop nodes
  - Connection lines between nodes

### ✅ AI Understanding
- Powered by **Qwen2.5:7b** (best for DSA understanding)
- Understands natural language:
  - "We have a hashmap" → Creates hashmap node
  - "I add 6 here" → Updates the last shape with value 6
  - "The quantity increases" → Understands context and updates variables
- Context-aware:
  - Remembers shapes created in session
  - Tracks variables mentioned
  - Learns from corrections

### ✅ Learning & Memory
- **Session Memory**: Tracks context during current session
- **Long-term Memory**: Stores corrections in database
- **Pattern Learning**: Learns from user corrections to improve future understanding
- Corrections are saved automatically when user corrects AI

### ✅ Manual Controls
- Add shapes manually (Array, HashMap, Heap)
- Screenshot tool (exports canvas as PNG)
- Clear all shapes
- Zoom controls

### ✅ AI Behavior
- AI only responds when corrected (apologizes and fixes)
- Otherwise, silently draws based on voice commands
- Deterministic output (same input → similar output)

## Usage

1. **Open Dry Runner**: Click the brain icon in the header
2. **Start Listening**: Click "Start Listening" button
3. **Speak naturally**: 
   - "Create a hashmap"
   - "Add 6 to the array"
   - "The count variable is 5"
4. **Correct if needed**: If AI misunderstands, correct it and it will learn
5. **Take screenshot**: Click download icon to save canvas
6. **Add manually**: Use manual controls if you don't want to speak

## Technical Details

### Libraries Used
- **React Flow**: Professional diagramming library (similar to Draw.io)
- **Web Speech API**: Browser-native speech recognition
- **html2canvas**: Screenshot functionality
- **Qwen2.5:7b**: AI model for understanding DSA concepts

### Database Schema
```sql
dry_runner_corrections (
  id, user_id, original_command, correction_command, 
  context, learned_pattern, created_at
)
```

### API Endpoints
- `POST /dry-runner/corrections` - Save a correction
- `GET /dry-runner/corrections` - Get user's corrections for learning

## Model Choice: Qwen2.5:7b

**Why Qwen2.5:7b?**
- ✅ Excellent coding/DSA understanding
- ✅ Fast inference (comparable to Gemini 2.0 Flash)
- ✅ Good at understanding context and relationships
- ✅ Deterministic output with low temperature (0.3)
- ✅ Already recommended for this codebase

**Alternative Models:**
- **DeepSeek Coder**: Better for pure coding, but slower
- **Llama 3.2 3B**: Faster, but less accurate for complex DSA concepts

## Future Enhancements

- [ ] Support for more data structures (graphs, linked lists)
- [ ] Animation for algorithm visualization
- [ ] Export to SVG/PDF
- [ ] Collaborative mode
- [ ] Voice commands for algorithm steps ("swap these two", "traverse the tree")

