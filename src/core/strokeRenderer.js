/**
 * Stroke Renderer
 * Renders hand-drawn strokes on Canvas with natural variations
 */

export class StrokeRenderer {
  constructor(canvas, handwritingProfile = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.profile = {
      strokeThickness: handwritingProfile.strokeThickness || 1.0,
      jitter: handwritingProfile.jitter || 1.0,
      baselineWobble: handwritingProfile.baselineWobble || 0.5,
      pressureVariation: handwritingProfile.pressureVariation || 0.2,
      ...handwritingProfile
    };
    
    this.strokeCache = new Map();
  }

  /**
   * Render a stroke with natural variations
   */
  renderStroke(stroke, progress = 1.0) {
    const style = stroke.style || {};
    const points = stroke.points || [];
    
    if (points.length < 2) return;

    this.ctx.save();
    
    // Apply stroke style
    this.ctx.strokeStyle = style.color || '#2C2C2C';
    this.ctx.lineWidth = this.applyPressureVariation(
      style.width || 1.0,
      stroke.pencilState?.pressure || 0.8
    );
    this.ctx.lineCap = style.cap || 'round';
    this.ctx.lineJoin = style.join || 'round';
    this.ctx.globalAlpha = style.opacity || 0.9;

    // Apply jitter to points
    const jitteredPoints = this.applyJitter(points);

    // Draw path
    this.ctx.beginPath();
    const visiblePoints = Math.floor(jitteredPoints.length * progress);
    
    for (let i = 0; i < visiblePoints; i++) {
      const point = jitteredPoints[i];
      if (i === 0) {
        this.ctx.moveTo(point.x, point.y);
      } else {
        this.ctx.lineTo(point.x, point.y);
      }
    }
    
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Render text with handwriting style
   */
  renderText(stroke, progress = 1.0) {
    const text = stroke.text || '';
    const position = stroke.position || { x: 0, y: 0 };
    const style = stroke.style || {};
    const fontSize = stroke.fontSize || 14;
    const visibleChars = Math.floor(text.length * progress);

    this.ctx.save();
    this.ctx.fillStyle = style.color || '#2C2C2C';
    this.ctx.globalAlpha = style.opacity || 0.85;
    this.ctx.font = `${fontSize}px "Caveat", "Kalam", "Patrick Hand", cursive`;

    // Apply baseline wobble
    const wobble = (Math.random() - 0.5) * this.profile.baselineWobble;
    
    for (let i = 0; i < visibleChars; i++) {
      const char = text[i];
      const charX = position.x + (i * fontSize * 0.6);
      const charY = position.y + wobble + (Math.random() - 0.5) * this.profile.baselineWobble;
      
      // Apply jitter to each character
      const jitterX = (Math.random() - 0.5) * this.profile.jitter;
      const jitterY = (Math.random() - 0.5) * this.profile.jitter;
      
      this.ctx.fillText(char, charX + jitterX, charY + jitterY);
    }
    
    this.ctx.restore();
  }

  /**
   * Render rectangle with wobbly edges
   */
  renderRectangle(stroke, progress = 1.0) {
    const points = stroke.points || [];
    if (points.length < 4) return;

    // Create wobbly path
    const wobblyPath = this.createWobblyRectangle(points);
    const style = stroke.style || {};

    this.ctx.save();
    this.ctx.strokeStyle = style.color || '#2C2C2C';
    this.ctx.lineWidth = this.applyPressureVariation(
      style.width || 1.2,
      stroke.pencilState?.pressure || 0.8
    );
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = style.opacity || 0.9;

    this.ctx.beginPath();
    const visiblePoints = Math.floor(wobblyPath.length * progress);
    
    for (let i = 0; i < visiblePoints; i++) {
      const point = wobblyPath[i];
      if (i === 0) {
        this.ctx.moveTo(point.x, point.y);
      } else {
        this.ctx.lineTo(point.x, point.y);
      }
    }
    
    if (progress >= 1.0) {
      this.ctx.closePath();
    }
    
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * Render arrow with imperfect arrowhead
   */
  renderArrow(stroke, progress = 1.0) {
    const points = stroke.points || [];
    if (points.length < 2) return;

    const style = stroke.style || {};
    const start = points[0];
    const end = points[points.length - 1];

    this.ctx.save();
    this.ctx.strokeStyle = style.color || '#2C2C2C';
    this.ctx.lineWidth = this.applyPressureVariation(
      style.width || 1.0,
      stroke.pencilState?.pressure || 0.8
    );
    this.ctx.lineCap = 'round';
    this.ctx.globalAlpha = style.opacity || 0.9;

    // Draw line
    const endProgress = Math.min(progress * 1.2, 1.0); // Arrowhead appears slightly before line completes
    const currentEnd = {
      x: start.x + (end.x - start.x) * endProgress,
      y: start.y + (end.y - start.y) * endProgress
    };

    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(currentEnd.x, currentEnd.y);
    this.ctx.stroke();

    // Draw arrowhead if line is complete enough
    if (progress > 0.8) {
      this.drawArrowhead(currentEnd, end, style);
    }

    this.ctx.restore();
  }

  drawArrowhead(point, target, style) {
    const angle = Math.atan2(target.y - point.y, target.x - point.x);
    const arrowLength = 8;
    const arrowWidth = 4;

    // Imperfect arrowhead (slightly asymmetrical)
    const jitter1 = (Math.random() - 0.5) * 0.2;
    const jitter2 = (Math.random() - 0.5) * 0.2;

    this.ctx.beginPath();
    this.ctx.moveTo(point.x, point.y);
    this.ctx.lineTo(
      point.x - arrowLength * Math.cos(angle - Math.PI / 6 + jitter1),
      point.y - arrowLength * Math.sin(angle - Math.PI / 6 + jitter1)
    );
    this.ctx.moveTo(point.x, point.y);
    this.ctx.lineTo(
      point.x - arrowLength * Math.cos(angle + Math.PI / 6 + jitter2),
      point.y - arrowLength * Math.sin(angle + Math.PI / 6 + jitter2)
    );
    this.ctx.stroke();
  }

  /**
   * Apply jitter to points for natural variation
   */
  applyJitter(points) {
    return points.map(point => ({
      x: point.x + (Math.random() - 0.5) * this.profile.jitter,
      y: point.y + (Math.random() - 0.5) * this.profile.jitter,
      pressure: point.pressure
    }));
  }

  /**
   * Create wobbly rectangle path
   */
  createWobblyRectangle(corners) {
    if (corners.length < 4) return corners;

    const path = [];
    const segments = 10; // Points per edge

    // Top edge
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = corners[0].x + (corners[1].x - corners[0].x) * t;
      const y = corners[0].y + (corners[1].y - corners[0].y) * t;
      path.push({
        x: x + (Math.random() - 0.5) * this.profile.jitter,
        y: y + (Math.random() - 0.5) * this.profile.jitter
      });
    }

    // Right edge
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = corners[1].x + (corners[2].x - corners[1].x) * t;
      const y = corners[1].y + (corners[2].y - corners[1].y) * t;
      path.push({
        x: x + (Math.random() - 0.5) * this.profile.jitter,
        y: y + (Math.random() - 0.5) * this.profile.jitter
      });
    }

    // Bottom edge
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = corners[2].x + (corners[3].x - corners[2].x) * t;
      const y = corners[2].y + (corners[3].y - corners[2].y) * t;
      path.push({
        x: x + (Math.random() - 0.5) * this.profile.jitter,
        y: y + (Math.random() - 0.5) * this.profile.jitter
      });
    }

    // Left edge
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const x = corners[3].x + (corners[0].x - corners[3].x) * t;
      const y = corners[3].y + (corners[0].y - corners[3].y) * t;
      path.push({
        x: x + (Math.random() - 0.5) * this.profile.jitter,
        y: y + (Math.random() - 0.5) * this.profile.jitter
      });
    }

    return path;
  }

  /**
   * Apply pressure variation to stroke width
   */
  applyPressureVariation(baseWidth, pressure) {
    const variation = (Math.random() - 0.5) * this.profile.pressureVariation;
    return baseWidth * (0.5 + pressure * 0.5) * (1 + variation);
  }

  /**
   * Clear canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render paper background
   */
  renderPaperBackground(mode = 'ruled') {
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Paper color
    this.ctx.fillStyle = '#FEFEFE';
    this.ctx.fillRect(0, 0, width, height);

    // Paper texture (subtle noise)
    this.addPaperTexture();

    if (mode === 'ruled' || mode === 'grid') {
      this.drawRuledLines(width, height);
    }

    if (mode === 'grid') {
      this.drawGridLines(width, height);
    }

    // Left margin line
    this.drawMarginLine();
  }

  drawRuledLines(width, height) {
    this.ctx.strokeStyle = '#E8E8E8';
    this.ctx.lineWidth = 0.5;
    
    const lineSpacing = 24;
    for (let y = 0; y < height; y += lineSpacing) {
      const wobble = (Math.random() - 0.5) * 0.5; // Paper texture wobble
      this.ctx.beginPath();
      this.ctx.moveTo(0, y + wobble);
      this.ctx.lineTo(width, y + wobble);
      this.ctx.stroke();
    }
  }

  drawGridLines(width, height) {
    this.ctx.strokeStyle = '#E0E0E0';
    this.ctx.lineWidth = 0.3;
    
    const verticalSpacing = 40;
    for (let x = 0; x < width; x += verticalSpacing) {
      const wobble = (Math.random() - 0.5) * 0.3;
      this.ctx.beginPath();
      this.ctx.moveTo(x + wobble, 0);
      this.ctx.lineTo(x + wobble, height);
      this.ctx.stroke();
    }
  }

  drawMarginLine() {
    this.ctx.strokeStyle = '#D0D0D0';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(80, 0);
    this.ctx.lineTo(80, this.canvas.height);
    this.ctx.stroke();
  }

  addPaperTexture() {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 3; // 2-3% opacity variation
      data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }
}

