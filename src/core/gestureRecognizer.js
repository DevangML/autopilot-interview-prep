/**
 * Gesture Recognizer
 * Recognizes user gestures and converts them to actions
 */

export class GestureRecognizer {
  constructor() {
    this.currentPath = [];
    this.isRecording = false;
    this.minStrokeLength = 20;
    this.recognitionTimeout = 500;
  }

  /**
   * Start recording a gesture
   */
  startGesture(point) {
    this.currentPath = [{ x: point.x, y: point.y, timestamp: Date.now() }];
    this.isRecording = true;
  }

  /**
   * Add point to current gesture
   */
  addPoint(point) {
    if (!this.isRecording) return;
    this.currentPath.push({ x: point.x, y: point.y, timestamp: Date.now() });
  }

  /**
   * End gesture and recognize
   */
  endGesture() {
    if (!this.isRecording || this.currentPath.length < 3) {
      this.isRecording = false;
      this.currentPath = [];
      return null;
    }

    const gesture = this.recognize(this.currentPath);
    this.isRecording = false;
    this.currentPath = [];
    return gesture;
  }

  /**
   * Recognize gesture from path
   */
  recognize(path) {
    if (path.length < 3) return null;

    // Calculate path properties
    const totalLength = this.calculatePathLength(path);
    const isClosed = this.isPathClosed(path);
    const curvature = this.calculateCurvature(path);
    const directionChanges = this.countDirectionChanges(path);

    // Arrow gesture (line with direction)
    if (totalLength > this.minStrokeLength && !isClosed && curvature < 0.3) {
      return {
        type: 'arrow',
        from: path[0],
        to: path[path.length - 1],
        confidence: 0.8
      };
    }

    // Circle/Selection gesture (closed loop)
    if (isClosed && totalLength > this.minStrokeLength * 2) {
      const bounds = this.getBounds(path);
      return {
        type: 'select',
        bounds,
        enclosed: true,
        confidence: 0.9
      };
    }

    // Scribble/Delete gesture (high curvature, many direction changes)
    if (directionChanges > path.length * 0.3 && curvature > 0.5) {
      const bounds = this.getBounds(path);
      return {
        type: 'delete',
        bounds,
        confidence: 0.7
      };
    }

    // Text gesture (small, compact path)
    if (totalLength < 50 && path.length > 5) {
      return {
        type: 'text',
        bounds: this.getBounds(path),
        confidence: 0.6
      };
    }

    // Bracket/Group gesture (curved bracket shape)
    if (this.isBracketShape(path)) {
      const bounds = this.getBounds(path);
      return {
        type: 'group',
        bounds,
        confidence: 0.75
      };
    }

    return null;
  }

  /**
   * Calculate total path length
   */
  calculatePathLength(path) {
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  /**
   * Check if path is closed (start and end are close)
   */
  isPathClosed(path, threshold = 30) {
    if (path.length < 3) return false;
    const start = path[0];
    const end = path[path.length - 1];
    const distance = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    );
    return distance < threshold;
  }

  /**
   * Calculate average curvature
   */
  calculateCurvature(path) {
    if (path.length < 3) return 0;
    
    let totalCurvature = 0;
    for (let i = 1; i < path.length - 1; i++) {
      const p1 = path[i - 1];
      const p2 = path[i];
      const p3 = path[i + 1];
      
      const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      
      const angle1 = Math.atan2(v1.y, v1.x);
      const angle2 = Math.atan2(v2.y, v2.x);
      const angleDiff = Math.abs(angle2 - angle1);
      const curvature = Math.min(angleDiff, Math.PI * 2 - angleDiff);
      
      totalCurvature += curvature;
    }
    
    return totalCurvature / (path.length - 2);
  }

  /**
   * Count direction changes
   */
  countDirectionChanges(path) {
    if (path.length < 3) return 0;
    
    let changes = 0;
    let lastDirection = null;
    
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      const direction = Math.atan2(dy, dx);
      
      if (lastDirection !== null) {
        const diff = Math.abs(direction - lastDirection);
        const normalizedDiff = Math.min(diff, Math.PI * 2 - diff);
        if (normalizedDiff > Math.PI / 4) { // 45 degree change
          changes++;
        }
      }
      
      lastDirection = direction;
    }
    
    return changes;
  }

  /**
   * Get bounding box of path
   */
  getBounds(path) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    path.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  /**
   * Check if path resembles a bracket shape
   */
  isBracketShape(path) {
    if (path.length < 5) return false;
    
    // Check for curved bracket pattern
    const firstThird = path.slice(0, Math.floor(path.length / 3));
    const lastThird = path.slice(Math.floor(path.length * 2 / 3));
    
    // First part should curve one way, last part should curve the other
    const firstCurve = this.calculateCurvature(firstThird);
    const lastCurve = this.calculateCurvature(lastThird);
    
    return firstCurve > 0.3 && lastCurve > 0.3;
  }
}

