/**
 * Stroke Script Generator
 * Generates stroke scripts from semantic operations
 */

import { PencilMode } from './pencilActor.js';

export class StrokeScriptGenerator {
  constructor(handwritingProfile = {}) {
    this.profile = handwritingProfile;
    this.variationSeed = Math.random();
  }

  /**
   * Generate stroke script for creating an array
   */
  generateArrayScript(arrayData, position) {
    const { elements = [], label = 'Array', indices = true } = arrayData;
    const cellWidth = 50;
    const cellHeight = 40;
    const startX = position.x;
    const startY = position.y;
    
    const strokes = [];
    let timestamp = 0;

    // Draw each cell
    elements.forEach((element, index) => {
      const cellX = startX + index * cellWidth;
      const cellY = startY;
      
      // Draw cell rectangle
      strokes.push({
        type: 'RECTANGLE',
        points: [
          { x: cellX, y: cellY },
          { x: cellX + cellWidth, y: cellY },
          { x: cellX + cellWidth, y: cellY + cellHeight },
          { x: cellX, y: cellY + cellHeight },
          { x: cellX, y: cellY }
        ],
        style: {
          width: 1.1 + (Math.random() - 0.5) * 0.2,
          color: '#2C2C2C',
          opacity: 0.9
        },
        timing: {
          startDelay: timestamp,
          duration: 300 + (Math.random() - 0.5) * 50,
          easing: 'ease-out'
        },
        pencilState: {
          position: { x: cellX, y: cellY },
          pressure: 0.7 + Math.random() * 0.2,
          mode: PencilMode.DRAW
        }
      });
      
      timestamp += 350;

      // Write index above
      if (indices) {
        strokes.push({
          type: 'TEXT',
          text: index.toString(),
          position: {
            x: cellX + cellWidth / 2 - 5,
            y: cellY - 15 + (Math.random() - 0.5) * 2
          },
          fontSize: 10,
          style: {
            width: 0.7,
            color: '#666666',
            opacity: 0.7
          },
          timing: {
            startDelay: timestamp,
            duration: 100,
            easing: 'linear'
          },
          pencilState: {
            position: { x: cellX + cellWidth / 2, y: cellY - 15 },
            pressure: 0.6,
            mode: PencilMode.WRITE
          },
          handwritingProfile: this.profile
        });
        
        timestamp += 120;
      }

      // Write value inside
      if (element !== undefined && element !== null) {
        strokes.push({
          type: 'TEXT',
          text: element.toString(),
          position: {
            x: cellX + cellWidth / 2 - 8,
            y: cellY + cellHeight / 2 + 5 + (Math.random() - 0.5) * 2
          },
          fontSize: 14,
          style: {
            width: 0.8,
            color: '#2C2C2C',
            opacity: 0.85
          },
          timing: {
            startDelay: timestamp,
            duration: 150,
            easing: 'linear'
          },
          pencilState: {
            position: { x: cellX + cellWidth / 2, y: cellY + cellHeight / 2 },
            pressure: 0.7,
            mode: PencilMode.WRITE
          },
          handwritingProfile: this.profile
        });
        
        timestamp += 170;
      }
    });

    // Write label
    if (label) {
      strokes.push({
        type: 'TEXT',
        text: label,
        position: {
          x: startX - 30,
          y: startY + cellHeight / 2 + 5
        },
        fontSize: 12,
        style: {
          width: 0.8,
          color: '#2C2C2C',
          opacity: 0.9
        },
        timing: {
          startDelay: 0,
          duration: label.length * 50,
          easing: 'linear'
        },
        pencilState: {
          position: { x: startX - 30, y: startY + cellHeight / 2 },
          pressure: 0.7,
          mode: PencilMode.WRITE
        },
        handwritingProfile: this.profile
      });
    }

    return {
      id: `array_${Date.now()}_${Math.random()}`,
      timestamp: 0,
      pencilState: {
        position: { x: startX, y: startY },
        pressure: 0.8,
        mode: PencilMode.DRAW
      },
      strokes,
      duration: timestamp
    };
  }

  /**
   * Generate stroke script for updating array cell value
   */
  generateArrayUpdateScript(oldValue, newValue, cellPosition) {
    const strokes = [];

    // Cross out old value
    if (oldValue !== undefined && oldValue !== null) {
      strokes.push({
        type: 'SCRIBBLE',
        points: [
          { x: cellPosition.x - 15, y: cellPosition.y - 5 },
          { x: cellPosition.x - 10, y: cellPosition.y },
          { x: cellPosition.x - 5, y: cellPosition.y + 2 },
          { x: cellPosition.x, y: cellPosition.y + 3 },
          { x: cellPosition.x + 5, y: cellPosition.y + 2 },
          { x: cellPosition.x + 10, y: cellPosition.y },
          { x: cellPosition.x + 15, y: cellPosition.y - 5 }
        ],
        style: {
          width: 2.0,
          color: '#CC0000',
          opacity: 0.8
        },
        timing: {
          startDelay: 0,
          duration: 150,
          easing: 'ease-in-out'
        },
        pencilState: {
          position: cellPosition,
          pressure: 0.9,
          mode: PencilMode.DRAW
        }
      });
    }

    // Write new value
    strokes.push({
      type: 'TEXT',
      text: newValue.toString(),
      position: {
        x: cellPosition.x - 8,
        y: cellPosition.y + 5 + (Math.random() - 0.5) * 2
      },
      fontSize: 14,
      style: {
        width: 0.8,
        color: '#2C2C2C',
        opacity: 0.85
      },
      timing: {
        startDelay: 200,
        duration: newValue.toString().length * 50,
        easing: 'linear'
      },
      pencilState: {
        position: cellPosition,
        pressure: 0.7,
        mode: PencilMode.WRITE
      },
      handwritingProfile: this.profile
    });

    return {
      id: `update_${Date.now()}`,
      timestamp: 0,
      pencilState: {
        position: cellPosition,
        pressure: 0.8,
        mode: PencilMode.DRAW
      },
      strokes,
      duration: 200 + newValue.toString().length * 50
    };
  }

  /**
   * Generate stroke script for recursion frame
   */
  generateRecursionFrameScript(frameData, position) {
    const { functionName, parameters, width = 200, height = 80 } = frameData;
    const startX = position.x;
    const startY = position.y;
    
    const strokes = [];
    let timestamp = 0;

    // Left edge (top to bottom)
    strokes.push({
      type: 'LINE',
      points: [
        { x: startX, y: startY },
        { x: startX, y: startY + height }
      ],
      style: {
        width: 1.3,
        color: '#4A90E2',
        opacity: 0.8
      },
      timing: {
        startDelay: timestamp,
        duration: 200,
        easing: 'ease-out'
      },
      pencilState: {
        position: { x: startX, y: startY },
        pressure: 0.8,
        mode: PencilMode.DRAW
      }
    });
    
    timestamp += 250;

    // Bottom edge (left to right)
    strokes.push({
      type: 'LINE',
      points: [
        { x: startX, y: startY + height },
        { x: startX + width, y: startY + height }
      ],
      style: {
        width: 1.3,
        color: '#4A90E2',
        opacity: 0.8
      },
      timing: {
        startDelay: timestamp,
        duration: 300,
        easing: 'ease-out'
      },
      pencilState: {
        position: { x: startX, y: startY + height },
        pressure: 0.8,
        mode: PencilMode.DRAW
      }
    });
    
    timestamp += 350;

    // Right edge (bottom to top, stops before top)
    strokes.push({
      type: 'LINE',
      points: [
        { x: startX + width, y: startY + height },
        { x: startX + width, y: startY + 10 } // Stop 10px from top
      ],
      style: {
        width: 1.3,
        color: '#4A90E2',
        opacity: 0.8
      },
      timing: {
        startDelay: timestamp,
        duration: 200,
        easing: 'ease-out'
      },
      pencilState: {
        position: { x: startX + width, y: startY + height },
        pressure: 0.8,
        mode: PencilMode.DRAW
      }
    });
    
    timestamp += 250;

    // Function label
    const paramString = Object.entries(parameters || {})
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
    const label = `${functionName}(${paramString})`;
    
    strokes.push({
      type: 'TEXT',
      text: label,
      position: {
        x: startX + 5,
        y: startY + 2
      },
      fontSize: 10,
      style: {
        width: 0.7,
        color: '#4A90E2',
        opacity: 0.9
      },
      timing: {
        startDelay: timestamp,
        duration: label.length * 30,
        easing: 'linear'
      },
      pencilState: {
        position: { x: startX + 5, y: startY + 2 },
        pressure: 0.6,
        mode: PencilMode.WRITE
      },
      handwritingProfile: this.profile
    });

    return {
      id: `recur_frame_${Date.now()}`,
      timestamp: 0,
      pencilState: {
        position: { x: startX, y: startY },
        pressure: 0.8,
        mode: PencilMode.DRAW
      },
      strokes,
      duration: timestamp + label.length * 30
    };
  }

  /**
   * Generate stroke script for pointer/arrow
   */
  generatePointerScript(from, to, label = null) {
    const strokes = [];
    
    // Draw arrow
    strokes.push({
      type: 'ARROW',
      points: [from, to],
      style: {
        width: 1.0,
        color: '#FF6B6B',
        opacity: 0.9
      },
      timing: {
        startDelay: 0,
        duration: 200,
        easing: 'ease-out'
      },
      pencilState: {
        position: from,
        pressure: 0.7,
        mode: PencilMode.DRAW
      }
    });

    // Write label if provided
    if (label) {
      strokes.push({
        type: 'TEXT',
        text: label,
        position: {
          x: (from.x + to.x) / 2 - 10,
          y: (from.y + to.y) / 2 - 10
        },
        fontSize: 10,
        style: {
          width: 0.7,
          color: '#FF6B6B',
          opacity: 0.8
        },
        timing: {
          startDelay: 250,
          duration: label.length * 30,
          easing: 'linear'
        },
        pencilState: {
          position: { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 },
          pressure: 0.6,
          mode: PencilMode.WRITE
        },
        handwritingProfile: this.profile
      });
    }

    return {
      id: `pointer_${Date.now()}`,
      timestamp: 0,
      pencilState: {
        position: from,
        pressure: 0.7,
        mode: PencilMode.DRAW
      },
      strokes,
      duration: label ? 250 + label.length * 30 : 200
    };
  }

  /**
   * Generate stroke script for cross-out (deletion)
   */
  generateCrossOutScript(boundingBox) {
    const centerX = (boundingBox.x + boundingBox.x + boundingBox.width) / 2;
    const centerY = (boundingBox.y + boundingBox.y + boundingBox.height) / 2;
    
    return {
      id: `crossout_${Date.now()}`,
      timestamp: 0,
      pencilState: {
        position: { x: centerX - 20, y: centerY - 5 },
        pressure: 0.9,
        mode: PencilMode.DRAW
      },
      strokes: [
        {
          type: 'SCRIBBLE',
          points: [
            { x: centerX - 20, y: centerY - 5 },
            { x: centerX - 10, y: centerY - 2 },
            { x: centerX, y: centerY },
            { x: centerX + 10, y: centerY + 2 },
            { x: centerX + 20, y: centerY + 5 }
          ],
          style: {
            width: 2.0,
            color: '#CC0000',
            opacity: 0.8
          },
          timing: {
            startDelay: 0,
            duration: 150,
            easing: 'ease-in-out'
          }
        }
      ],
      duration: 150
    };
  }
}

