/**
 * Pencil Actor System
 * Manages pencil state, movement, and stroke execution
 */

export const PencilMode = {
  DRAW: 'DRAW',
  WRITE: 'WRITE',
  ERASE: 'ERASE',
  SHADE: 'SHADE',
  HIGHLIGHT: 'HIGHLIGHT',
  CUT: 'CUT',
  POINT: 'POINT'
};

export class PencilActor {
  constructor(initialState = {}) {
    this.state = {
      position: initialState.position || { x: 0, y: 0 },
      pressure: initialState.pressure || 0.8,
      tilt: initialState.tilt || 0,
      speed: initialState.speed || 0,
      mode: initialState.mode || PencilMode.DRAW,
      color: initialState.color || '#2C2C2C',
      opacity: initialState.opacity || 0.9,
      ...initialState
    };
    
    this.listeners = new Set();
    this.isAnimating = false;
    this.currentAnimation = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notify();
  }

  /**
   * Move pencil to target position with animation
   * @param {Object} target - { x, y }
   * @param {Object} options - { speed, easing }
   */
  async moveTo(target, options = {}) {
    const { speed = 400, easing = 'easeInOut' } = options;
    const start = { ...this.state.position };
    const distance = Math.sqrt(
      Math.pow(target.x - start.x, 2) + Math.pow(target.y - start.y, 2)
    );
    const duration = Math.max(100, (distance / speed) * 1000);

    return new Promise((resolve) => {
      const startTime = performance.now();
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Apply easing
        const eased = this.applyEasing(progress, easing);
        
        // Interpolate position
        const x = start.x + (target.x - start.x) * eased;
        const y = start.y + (target.y - start.y) * eased;
        
        this.setState({ position: { x, y } });
        
        if (progress < 1) {
          this.currentAnimation = requestAnimationFrame(animate);
        } else {
          this.currentAnimation = null;
          resolve();
        }
      };
      
      this.currentAnimation = requestAnimationFrame(animate);
    });
  }

  applyEasing(t, type) {
    switch (type) {
      case 'easeInOut':
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      case 'easeOut':
        return 1 - Math.pow(1 - t, 3);
      case 'easeIn':
        return t * t;
      case 'linear':
        return t;
      default:
        return t;
    }
  }

  /**
   * Execute a stroke script
   * @param {Object} strokeScript - Stroke script from spec
   * @param {Function} onStrokeProgress - Callback for stroke progress
   */
  async executeStrokeScript(strokeScript, onStrokeProgress) {
    this.isAnimating = true;
    
    // Set initial pencil state
    if (strokeScript.pencilState) {
      this.setState(strokeScript.pencilState);
    }

    // Move to starting position if needed
    if (strokeScript.strokes && strokeScript.strokes.length > 0) {
      const firstStroke = strokeScript.strokes[0];
      if (firstStroke.points && firstStroke.points.length > 0) {
        const startPoint = firstStroke.points[0];
        await this.moveTo({ x: startPoint.x, y: startPoint.y });
      }
    }

    // Execute each stroke
    for (const stroke of strokeScript.strokes || []) {
      await this.executeStroke(stroke, onStrokeProgress);
    }

    this.isAnimating = false;
  }

  async executeStroke(stroke, onStrokeProgress) {
    // Wait for start delay
    if (stroke.timing?.startDelay) {
      await this.sleep(stroke.timing.startDelay);
    }

    // Execute stroke based on type
    switch (stroke.type) {
      case 'LINE':
      case 'RECTANGLE':
      case 'CIRCLE':
      case 'ARROW':
        await this.drawPath(stroke, onStrokeProgress);
        break;
      case 'TEXT':
        await this.writeText(stroke, onStrokeProgress);
        break;
      case 'SCRIBBLE':
      case 'ZIGZAG':
        await this.drawScribble(stroke, onStrokeProgress);
        break;
      default:
        await this.drawPath(stroke, onStrokeProgress);
    }

    // Pencil lift pause
    await this.sleep(50);
  }

  async drawPath(stroke, onStrokeProgress) {
    const points = stroke.points || [];
    if (points.length < 2) return;

    const duration = stroke.timing?.duration || 300;
    const startTime = performance.now();

    // Move to first point
    await this.moveTo({ x: points[0].x, y: points[0].y });

    // Draw path progressively
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const segmentDuration = duration / (points.length - 1);
      
      await this.moveTo({ x: point.x, y: point.y }, { speed: 400 });
      
      if (onStrokeProgress) {
        onStrokeProgress({
          type: 'path',
          currentPoint: point,
          progress: i / points.length,
          stroke
        });
      }
    }
  }

  async writeText(stroke, onStrokeProgress) {
    const text = stroke.text || '';
    const position = stroke.position || { x: 0, y: 0 };
    const duration = stroke.timing?.duration || text.length * 50;

    // Move to text position
    await this.moveTo(position);

    // Write each character progressively
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charDuration = duration / text.length;
      
      if (onStrokeProgress) {
        onStrokeProgress({
          type: 'text',
          character: char,
          position: {
            x: position.x + (i * 8), // Approximate character width
            y: position.y
          },
          progress: (i + 1) / text.length,
          stroke
        });
      }
      
      await this.sleep(charDuration);
    }
  }

  async drawScribble(stroke, onStrokeProgress) {
    const points = stroke.points || [];
    if (points.length < 2) return;

    const duration = stroke.timing?.duration || 150;
    
    // Draw erratic path
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const segmentDuration = duration / (points.length - 1);
      
      // Add jitter for scribble effect
      const jitteredPoint = {
        x: point.x + (Math.random() - 0.5) * 2,
        y: point.y + (Math.random() - 0.5) * 2
      };
      
      await this.moveTo(jitteredPoint, { speed: 300 });
      
      if (onStrokeProgress) {
        onStrokeProgress({
          type: 'scribble',
          currentPoint: jitteredPoint,
          progress: i / points.length,
          stroke
        });
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    if (this.currentAnimation) {
      cancelAnimationFrame(this.currentAnimation);
      this.currentAnimation = null;
    }
    this.isAnimating = false;
  }
}

