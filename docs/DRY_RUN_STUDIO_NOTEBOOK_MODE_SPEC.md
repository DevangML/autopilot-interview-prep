# Dry-Run Studio: Notebook Mode Specification

## Document Purpose
This specification defines the complete behavior, visual system, and interaction model for Notebook Mode in Dry-Run Studio. It provides sufficient detail for implementation without requiring design decisions.

---

## 1. Core Visual System

### 1.1 Paper Background

**Ruled Paper Mode (Default)**
- Horizontal ruled lines: 0.5px stroke, color `#E8E8E8`, spacing 24px
- Left margin line: 1px stroke, color `#D0D0D0`, positioned at 80px from left edge
- Paper texture: Subtle noise overlay (2-3% opacity, grayscale)
- Paper color: `#FEFEFE` (slightly off-white)
- Unevenness: Random ±0.5px vertical offset per line segment (simulates paper texture)

**Grid Paper Mode (Optional)**
- Same as ruled, plus vertical lines every 40px
- Grid lines: 0.3px stroke, color `#E0E0E0`

**Blank Paper Mode (Optional)**
- No lines, only paper texture and color

**Toggle Behavior**
- User can switch modes via toolbar
- Existing strokes remain; only background changes

### 1.2 Handwriting System

**Font Requirements**
- Primary: Handwriting-style variable font (e.g., "Caveat", "Kalam", "Patrick Hand")
- Fallback: System handwriting font stack
- Character rendering: Each character drawn as stroke sequence, not instant text

**Per-User Handwriting Profile**
```typescript
interface HandwritingProfile {
  strokeThickness: number;      // 0.8-1.5px base
  slant: number;                 // -15° to +15° (italic angle)
  jitter: number;                // 0-2px random offset per stroke
  letterSpacing: number;         // 0.8-1.2x normal
  baselineWobble: number;        // 0-1px vertical variation
  pressureVariation: number;     // 0-0.3 opacity variation
  speedVariation: number;         // stroke timing variation
}
```

**AI Writing Animation**
- Characters appear via progressive stroke rendering
- Each character takes 50-150ms to draw (varies by complexity)
- Strokes follow natural writing order (top-to-bottom, left-to-right)
- Pencil lifts between characters (50ms pause)

**Label Positioning**
- Labels float slightly above/below elements (±2px vertical jitter)
- Horizontal alignment: natural left-alignment with slight variation

---

## 2. Pencil Actor System

### 2.1 Pencil State

```typescript
interface PencilState {
  position: { x: number; y: number };
  pressure: number;              // 0.0-1.0 (affects stroke width)
  tilt: number;                   // 0-45° (affects stroke shape)
  speed: number;                  // pixels/ms (affects stroke smoothness)
  mode: PencilMode;
  color: string;                  // Default: #2C2C2C (pencil gray)
  opacity: number;                // 0.7-1.0 (pressure-based)
}

enum PencilMode {
  DRAW,        // Normal drawing
  WRITE,       // Text writing (thinner strokes)
  ERASE,       // Eraser mode (white/transparent)
  SHADE,       // Shading/hatching
  HIGHLIGHT,   // Yellow highlighter effect
  CUT,         // Cut line (zig-zag)
  POINT        // Pointing (no stroke, just cursor)
}
```

### 2.2 Pencil Cursor Visual

**Default Cursor (POINT mode)**
- Visible pencil tip icon at current position
- Icon: Small pencil silhouette, rotates with tilt angle
- Size: 16x16px
- Follows mouse/touch position when user is drawing

**Active Drawing Cursor**
- Pencil tip becomes larger (20x20px)
- Shows pressure indicator (ring around tip, size varies with pressure)
- Trail effect: Faint trail behind moving pencil (fades after 200ms)

**Mode Indicators**
- ERASE: Cursor shows eraser icon (pink eraser tip)
- CUT: Cursor shows scissors icon
- HIGHLIGHT: Cursor shows highlighter marker icon

### 2.3 Pencil Movement Rules

**No Teleportation Rule**
- Every state change must be animated via pencil movement
- Minimum movement speed: 200px/s
- Maximum movement speed: 800px/s
- Acceleration/deceleration: Ease-in-out curve

**Stroke Drawing Rules**
- Each stroke is a path with:
  - Start point (pencil down)
  - Control points (pencil moving)
  - End point (pencil up)
- Stroke width varies with pressure: `baseWidth * (0.5 + pressure * 0.5)`
- Stroke opacity varies with speed: Faster = lighter, slower = darker
- Natural overshoot: Lines extend 1-3px beyond intended endpoint, then correct

**Pencil Lift Behavior**
- Between strokes: 50-150ms pause
- Pencil icon fades slightly during lift
- Next stroke starts from lift position (no jump)

---

## 3. Stroke Script Format

### 3.1 Stroke Script Structure

```typescript
interface StrokeScript {
  id: string;                    // Unique identifier
  timestamp: number;              // When to start (relative to step start)
  pencilState: PencilState;       // Pencil state at start
  strokes: Stroke[];              // Sequence of strokes
  duration: number;               // Total time in ms
}

interface Stroke {
  type: StrokeType;
  points: Point[];               // Path points
  style: StrokeStyle;
  timing: StrokeTiming;
}

enum StrokeType {
  LINE,           // Straight or curved line
  ARC,            // Circular arc
  TEXT,           // Handwritten text
  SCRIBBLE,       // Erratic scribble (for deletion)
  ZIGZAG,         // Cut line pattern
  CIRCLE,         // Hand-drawn circle
  RECTANGLE,      // Hand-drawn rectangle (wobbly)
  ARROW,          // Arrow with imperfect arrowhead
  BRACE,          // Curly brace
  UNDERLINE,      // Underline (straight or wavy)
  CROSSOUT        // Strike-through
}

interface Point {
  x: number;
  y: number;
  pressure?: number;               // Optional per-point pressure
  timestamp?: number;             // Optional per-point timing
}

interface StrokeStyle {
  width: number;                  // Base width in px
  color: string;
  opacity: number;
  cap: 'round' | 'square';        // Line cap style
  join: 'round' | 'miter';        // Line join style
  dashArray?: number[];           // For dashed lines
}

interface StrokeTiming {
  startDelay: number;             // ms delay before starting
  duration: number;              // ms to complete stroke
  easing: string;                // Easing function name
}
```

### 3.2 Stroke Script Examples

**Example: Drawing an Array Cell**
```json
{
  "id": "array_cell_0",
  "timestamp": 0,
  "pencilState": { "position": { "x": 100, "y": 200 }, "pressure": 0.8, "mode": "DRAW" },
  "strokes": [
    {
      "type": "RECTANGLE",
      "points": [
        { "x": 100, "y": 200 },
        { "x": 150, "y": 200 },
        { "x": 150, "y": 240 },
        { "x": 100, "y": 240 },
        { "x": 100, "y": 200 }
      ],
      "style": { "width": 1.2, "color": "#2C2C2C", "opacity": 0.9 },
      "timing": { "startDelay": 0, "duration": 300, "easing": "ease-out" }
    }
  ],
  "duration": 300
}
```

**Example: Writing Text**
```json
{
  "id": "label_A",
  "timestamp": 350,
  "pencilState": { "position": { "x": 105, "y": 210 }, "pressure": 0.6, "mode": "WRITE" },
  "strokes": [
    {
      "type": "TEXT",
      "points": [],  // Text uses character paths, not points
      "style": { "width": 0.8, "color": "#2C2C2C", "opacity": 0.85 },
      "timing": { "startDelay": 0, "duration": 200, "easing": "linear" },
      "text": "A[0]",
      "fontSize": 14,
      "handwritingProfile": { "jitter": 1.2, "baselineWobble": 0.8 }
    }
  ],
  "duration": 200
}
```

**Example: Cross-Out (Deletion)**
```json
{
  "id": "crossout_value",
  "timestamp": 0,
  "pencilState": { "position": { "x": 120, "y": 220 }, "pressure": 0.9, "mode": "DRAW" },
  "strokes": [
    {
      "type": "SCRIBBLE",
      "points": [
        { "x": 110, "y": 215 },
        { "x": 115, "y": 218 },
        { "x": 120, "y": 220 },
        { "x": 125, "y": 222 },
        { "x": 130, "y": 220 },
        { "x": 135, "y": 218 }
      ],
      "style": { "width": 2.0, "color": "#CC0000", "opacity": 0.8 },
      "timing": { "startDelay": 0, "duration": 150, "easing": "ease-in-out" }
    }
  ],
  "duration": 150
}
```

### 3.3 Stroke Script Generation Rules

**For Each Semantic Change:**
1. Calculate pencil path from current position to target
2. Generate stroke sequence for the visual change
3. Assign timestamps to create natural pacing
4. Add pencil lifts between distinct operations
5. Include slight variations (jitter, pressure changes) for realism

**Variability Injection:**
- Same semantic operation produces slightly different stroke scripts each time
- Variation parameters:
  - Point positions: ±1-2px random offset
  - Stroke width: ±0.1px variation
  - Timing: ±10% duration variation
  - Pressure: ±0.1 variation

---

## 4. Sketch Renderer Architecture

### 4.1 Two-Layer System

**Layer A: Semantic Layer (React Flow)**
- Purpose: Logical structure, selection, handles, connections
- Visibility: Invisible to user (or very faint outline in debug mode)
- Contains:
  - Node definitions with bounding boxes
  - Edge definitions with connection points
  - Group boundaries
  - Selection state
  - Interaction handles

**Layer B: Sketch Layer (Canvas/SVG)**
- Purpose: Visual rendering of hand-drawn appearance
- Visibility: User-visible layer
- Contains:
  - Stroke paths derived from semantic geometry
  - Handwriting text overlays
  - Pencil cursor
  - Eraser marks
  - Cut lines

### 4.2 Mapping: Semantic → Sketch

**For Each Semantic Node:**
```typescript
interface NodeSketchMapping {
  semanticNodeId: string;
  anchorBox: BoundingBox;         // Invisible React Flow node bounds
  strokePlan: StrokeScript[];     // How to draw this node
  editPlan: EditPlan;             // How to redraw on change
  zIndex: number;                 // Drawing order
}

interface EditPlan {
  eraseRegion?: BoundingBox;       // What to erase first
  redrawStrokes: StrokeScript[];   // New strokes to draw
  preserveStrokes: string[];       // Stroke IDs to keep unchanged
}
```

**Stroke Plan Generation:**
1. Analyze semantic node type and properties
2. Generate base stroke script for structure
3. Add label strokes for text content
4. Add decorative strokes (underlines, highlights, etc.)
5. Apply handwriting profile variations
6. Cache stroke plan until node changes

**Edit Plan Generation (On Update):**
1. Compare old vs new node state
2. Identify changed regions
3. Generate erase strokes for changed areas
4. Generate new strokes for updated content
5. Preserve unchanged strokes (performance optimization)

### 4.3 Rendering Pipeline

**Step 1: Semantic Update**
- React Flow updates node/edge state
- Triggers sketch layer update

**Step 2: Stroke Plan Recalculation**
- Compare new state to cached stroke plan
- Generate edit plan (what to erase, what to redraw)
- Update stroke cache

**Step 3: Pencil Animation**
- Execute stroke script with pencil actor
- Show pencil movement and stroke drawing
- Update canvas/SVG in real-time

**Step 4: Finalization**
- Stroke script completes
- Pencil lifts
- Final state cached for next edit

---

## 5. Gesture Interpretation

### 5.1 User Pencil Gestures

**Arrow to Connect (Pointer Gesture)**
- User draws arrow from point A to point B
- System detects:
  - Start point near a node handle
  - Arrow path (recognized by arrowhead or direction)
  - End point near another node handle
- Action: Create edge between nodes
- Visual: System redraws arrow in notebook style (may adjust path slightly)

**Circle to Select (Lasso Gesture)**
- User draws closed loop (circle or irregular shape)
- System detects:
  - Closed path
  - Enclosed nodes (point-in-polygon test)
- Action: Select all enclosed nodes
- Visual: Hand-drawn selection halo around selected nodes

**Scribble to Delete (Strike-Through Gesture)**
- User draws erratic scribble over an element
- System detects:
  - Scribble pattern (high curvature, multiple direction changes)
  - Overlap with node bounding box
- Action: Mark node for deletion
- Visual: System draws cross-out stroke, then erases element

**Write to Edit (Text Overlay Gesture)**
- User writes text on top of existing value
- System detects:
  - Text recognition (handwriting OCR or manual input)
  - Overlap with editable node region
- Action: Update node value
- Visual: Old value gets strike-through, new value written above

**Bracket/Box to Group (Grouping Gesture)**
- User draws bracket `{` or box around region
- System detects:
  - Bracket shape or closed rectangle
  - Enclosed nodes
- Action: Create group containing nodes
- Visual: Hand-drawn bracket or box around group

**Vertical Line + Move (Cut-and-Paste Gesture)**
- User draws vertical line through region, then drags
- System detects:
  - Cut line (vertical line crossing nodes)
  - Drag gesture after cut
- Action: Split group, move selected portion
- Visual: Cut line appears, region separates, dragged portion moves

### 5.2 Gesture Recognition Rules

**Pattern Matching:**
- Use stroke analysis: curvature, direction changes, closure
- Minimum stroke length: 20px for gestures
- Maximum recognition time: 500ms after gesture completion
- Confidence threshold: 0.7 (70% match to pattern)

**Ambiguity Resolution:**
- If gesture matches multiple patterns, show disambiguation menu
- Menu appears as handwritten list near gesture
- User selects intended action

**Gesture Feedback:**
- Show recognition hint: "Connecting..." or "Selecting..." as handwritten note
- If recognition fails, show "?" mark and allow retry

---

## 6. Open-Top Recursion Box

### 6.1 Visual Specification

**Structure:**
- Left edge: Vertical line, hand-drawn, 60-80px height
- Right edge: Vertical line, hand-drawn, same height
- Bottom edge: Horizontal line connecting left and right
- Top edge: **MISSING** (intentionally open)
- Label: Handwritten function call signature near top-left
  - Format: `functionName(param1, param2, ...)`
  - Font size: 10-12px
  - Position: 5px from left edge, 2px below where top would be

**Styling:**
- Stroke width: 1.0-1.5px (slightly thicker than normal lines)
- Color: `#4A90E2` (blue pencil) or `#2C2C2C` (default)
- Opacity: 0.7-0.9
- Corners: Rounded, imperfect (not sharp 90°)
- Slight wobble: ±1px variation along edges

**Stacking Behavior:**
- Nested calls stack vertically
- Each new call pushes a new box below the previous
- Spacing: 10-15px vertical gap between boxes
- Alignment: Left edges align (stacked like notebook notes)
- Visual depth: Slight shadow/offset to show stacking (2-3px right/down offset per level)

### 6.2 Recursion Frame State

```typescript
interface RecursionFrame {
  id: string;
  functionName: string;
  parameters: { [key: string]: any };
  level: number;                  // Nesting depth (0 = top level)
  position: { x: number; y: number };
  width: number;                  // Dynamic based on content
  height: number;                // Grows with nested calls
  state: 'active' | 'returned' | 'erased';
  returnValue?: any;             // Set when frame returns
  children: string[];             // IDs of nested frames
}
```

### 6.3 Step Integration

**On Function Call:**
1. Create new recursion frame
2. Generate stroke script:
   - Draw left edge (top to bottom)
   - Draw bottom edge (left to right)
   - Draw right edge (bottom to top, stops before top)
   - Write function label
3. Animate pencil drawing the frame
4. Push frame onto stack

**On Function Return:**
1. Mark frame as 'returned'
2. Generate stroke script:
   - Write return value near bottom-right of frame
   - Optional: Draw small "return" arrow or checkmark
   - Fade frame slightly (opacity 0.5)
3. Animate return annotation
4. Pop frame from stack (but keep visual for history)

**On Nested Call:**
1. Create child frame below current
2. Extend parent frame's height to accommodate child
3. Draw child frame (same stroke script as initial call)
4. Update parent's `children` array

**Visual Example:**
```
recur(0, 5)                    ← Top frame (open top)
├─ [left edge]
├─ [content: array state]
├─ [right edge]
└─ recur(1, 4)                 ← Nested frame
   ├─ [left edge]
   ├─ [content: updated state]
   ├─ [right edge]
   └─ recur(2, 3)              ← Further nested
      └─ [return: result]
```

### 6.4 Stroke Script for Recursion Box

```json
{
  "id": "recur_frame_0",
  "timestamp": 0,
  "pencilState": { "position": { "x": 100, "y": 200 }, "pressure": 0.8, "mode": "DRAW" },
  "strokes": [
    {
      "type": "LINE",
      "points": [
        { "x": 100, "y": 200 },
        { "x": 100, "y": 280 }
      ],
      "style": { "width": 1.3, "color": "#4A90E2", "opacity": 0.8 },
      "timing": { "startDelay": 0, "duration": 200, "easing": "ease-out" }
    },
    {
      "type": "LINE",
      "points": [
        { "x": 100, "y": 280 },
        { "x": 250, "y": 280 }
      ],
      "style": { "width": 1.3, "color": "#4A90E2", "opacity": 0.8 },
      "timing": { "startDelay": 250, "duration": 300, "easing": "ease-out" }
    },
    {
      "type": "LINE",
      "points": [
        { "x": 250, "y": 280 },
        { "x": 250, "y": 200 }
      ],
      "style": { "width": 1.3, "color": "#4A90E2", "opacity": 0.8 },
      "timing": { "startDelay": 600, "duration": 200, "easing": "ease-out" }
    },
    {
      "type": "TEXT",
      "text": "recur(0, 5)",
      "position": { "x": 105, "y": 202 },
      "style": { "width": 0.7, "color": "#4A90E2", "opacity": 0.9 },
      "timing": { "startDelay": 850, "duration": 250, "easing": "linear" }
    }
  ],
  "duration": 1100
}
```

---

## 7. Data Structure Visual Styles (Notebook Mode)

### 7.1 Array

**Visual:**
- Row of hand-drawn boxes (not perfect rectangles)
- Each box: Wobbly borders, rounded corners, slight size variation
- Indices: Handwritten above boxes, slightly misaligned
- Values: Handwritten inside boxes, centered with slight offset
- Pointer/iterator: Hand-drawn arrow pointing to current cell

**Stroke Plan:**
1. Draw boxes one by one (left to right)
2. Write indices above boxes
3. Write values inside boxes
4. Draw pointer arrow if iterator exists

**Example Stroke Script:**
```json
{
  "strokes": [
    { "type": "RECTANGLE", "points": [...], "style": { "width": 1.1 } },
    { "type": "TEXT", "text": "0", "position": { "x": 105, "y": 180 } },
    { "type": "TEXT", "text": "5", "position": { "x": 125, "y": 210 } },
    { "type": "ARROW", "points": [...], "style": { "width": 1.0, "color": "#FF6B6B" } }
  ]
}
```

### 7.2 Linked List

**Visual:**
- Boxes: Hand-drawn rectangles with two regions
  - Left region: Value (handwritten)
  - Right region: Pointer area (small box or arrow)
- Arrows: Hand-drawn connecting arrows between nodes
- Arrowheads: Imperfect, slightly asymmetrical
- Null pointer: Small "null" or "∅" handwritten, or X mark

**Stroke Plan:**
1. Draw node box (value region + pointer region)
2. Write value in left region
3. Draw pointer indicator in right region
4. Draw arrow to next node (if exists)
5. Repeat for each node

### 7.3 Binary Tree

**Visual:**
- Nodes: Hand-drawn circles or rounded blobs (not perfect circles)
- Edges: Pencil lines connecting parent to children
- Labels: Values handwritten inside nodes
- Layout: Hierarchical, but with natural spacing (not rigid grid)

**Stroke Plan:**
1. Draw root node (circle)
2. Write root value
3. Draw left edge (curved line)
4. Draw left child (recursive)
5. Draw right edge
6. Draw right child (recursive)

**Variation:**
- Node sizes vary slightly (±2px)
- Edge curves are natural (not straight lines)
- Spacing adjusts to content

### 7.4 Heap

**Visual:**
- Array representation: Hand-drawn array with indices
- Tree overlay (optional): Lightly sketched tree structure over array
- Parent-child mapping: Hand-drawn arrows or scribbled lines
- Heap property indicators: Small checkmarks or notes

**Stroke Plan:**
1. Draw array structure (see Array section)
2. Optionally draw tree overlay (light strokes, opacity 0.3)
3. Draw mapping lines/arrows
4. Write heap property notes in margins

### 7.5 Hash Table

**Visual:**
- Buckets: Scribbled containers (irregular shapes)
- Keys: Handwritten in buckets
- Values: Handwritten next to keys (or in separate area)
- Collisions: Small chains drawn inline (linked list style)
- Hash function: Shown as handwritten formula in margin

**Stroke Plan:**
1. Draw bucket shapes (irregular rectangles)
2. Write keys and values
3. Draw collision chains (if any)
4. Write hash function annotation

### 7.6 Graph

**Visual:**
- Nodes: Doodles (irregular shapes, not circles)
- Edges: Curved pencil arcs (not straight lines)
- Weights: Handwritten along edges (small text)
- Labels: Node names handwritten inside/next to nodes

**Stroke Plan:**
1. Draw nodes as irregular shapes
2. Write node labels
3. Draw edges as curved arcs
4. Write edge weights

### 7.7 Segment Tree

**Visual:**
- Tree structure: Hand-drawn binary tree
- Range labels: Handwritten at each node (e.g., "[0, 7]")
- Values: Handwritten inside nodes
- Lazy tags: Small corner notes (handwritten, smaller font)
- Update marks: Highlighted regions with pencil shading

**Stroke Plan:**
1. Draw tree structure
2. Write range labels
3. Write node values
4. Add lazy tags as corner annotations
5. Highlight updated regions

### 7.8 String Structures

**Trie:**
- Nodes: Small circles with characters
- Edges: Labeled with characters (handwritten)
- Word markers: Small checkmarks or stars

**Suffix Tree:**
- Compact tree with edge labels
- Labels written along edges (handwritten text)

### 7.9 Persistent Structures

**Version History:**
- Show multiple versions side-by-side
- Each version: Hand-drawn copy
- Version labels: "v1", "v2", etc. handwritten
- Changes highlighted with different color pencil

### 7.10 Probabilistic Structures

**Bloom Filter:**
- Array of bits with hash annotations
- Hash functions shown as handwritten formulas
- Set membership: Checkmarks or X marks

**Skip List:**
- Multiple levels drawn as horizontal lists
- Connections: Hand-drawn arrows between levels
- Levels labeled: "L0", "L1", etc.

---

## 8. Timeline and Step Engine

### 8.1 Step Definition

```typescript
interface Step {
  id: string;
  timestamp: number;
  semanticDelta: SemanticDelta;
  strokeScript: StrokeScript[];
  description: string;            // Human-readable step description
  branchId?: string;             // For branching timelines
}

interface SemanticDelta {
  nodesAdded: Node[];
  nodesUpdated: NodeUpdate[];
  nodesDeleted: string[];        // Node IDs
  edgesAdded: Edge[];
  edgesDeleted: string[];        // Edge IDs
  groupsCreated: Group[];
  groupsModified: GroupUpdate[];
}

interface NodeUpdate {
  nodeId: string;
  oldState: Node;
  newState: Node;
  changedFields: string[];       // Which properties changed
}

interface StrokeScript {
  // As defined in section 3.1
}
```

### 8.2 Step Execution

**Forward Step:**
1. Apply semantic delta to React Flow
2. Execute stroke script with pencil actor
3. Update timeline state
4. Cache step for backstep

**Backstep:**
1. Reverse semantic delta (undo React Flow changes)
2. Reverse stroke script:
   - Option A (Realism Mode: Erase): Erase newly drawn strokes
   - Option B (Realism Mode: Fade): Fade new strokes, redraw old strokes
3. Update timeline state
4. Restore previous step state

**Realism Mode Selection:**
- User preference: "Erase on backstep" vs "Fade on backstep"
- Erase: More realistic (like erasing pencil)
- Fade: Faster, shows history

### 8.3 Branching

**Branch Creation:**
- User can create branch at any step
- Branch keeps its own stroke history
- Visual: Branch indicator (hand-drawn branch symbol in margin)

**Branch State:**
```typescript
interface Branch {
  id: string;
  parentStepId: string;
  steps: Step[];
  strokeHistory: StrokeScript[];
  currentStepIndex: number;
}
```

**Branch Switching:**
- Switch between branches
- Each branch maintains its visual state
- Stroke history preserved per branch

### 8.4 Timeline UI (Notebook Style)

**Timeline Indicator:**
- Hand-drawn timeline in left margin
- Steps marked as small numbers (1, 2, 3, ...)
- Current step highlighted with circle
- Branches shown as forked lines

**Controls:**
- Backstep button: Hand-drawn "←" arrow
- Forward step button: Hand-drawn "→" arrow
- Branch button: Hand-drawn branch symbol
- All controls look handwritten, not UI buttons

---

## 9. Handwritten Annotation Library

### 9.1 Arrow Types

**Straight Arrow:**
- Line with arrowhead
- Arrowhead: Hand-drawn, slightly asymmetrical
- Stroke width: 1.0-1.5px

**Curved Arrow:**
- Curved path (bezier curve)
- Arrowhead at end
- Natural curve (not perfect arc)

**Hooked Arrow:**
- Arrow with hook at end (for pointers)
- Hook: Small curved segment

**Double Arrow:**
- Two parallel arrows (bidirectional)
- Slight offset between arrows

### 9.2 Grouping Annotations

**Curly Braces:**
- Hand-drawn `{` and `}` shapes
- Slight wobble in curves
- Used to group related elements

**Boxes:**
- Hand-drawn rectangles around groups
- Not perfect rectangles (wobbly edges)
- Can be dashed or solid

**Brackets:**
- Hand-drawn `[` and `]` shapes
- Used for array ranges or intervals

### 9.3 Emphasis Annotations

**Underline:**
- Straight or wavy line under text
- Stroke width: 1.0px
- Color: Same as text or highlight color

**Wavy Underline:**
- Sinuous line (for emphasis or errors)
- 2-3 wave cycles

**Double Underline:**
- Two parallel lines
- Slight offset

### 9.4 Deletion Annotations

**Single Cross-Out:**
- Single diagonal line through text
- Stroke width: 1.5-2.0px
- Color: Red or default

**Double Cross-Out:**
- Two diagonal lines (X pattern)
- More emphatic deletion

**Heavy Scribble:**
- Multiple overlapping strokes
- Erratic pattern
- Maximum emphasis

### 9.5 Margin Annotations

**Left Margin Callouts:**
- Handwritten notes in left margin
- Connected to elements with dashed lines
- Font size: 10-12px
- Color: Blue or gray

**Numbered Steps:**
- Numbers (1, 2, 3, ...) in margin
- Connected to corresponding elements
- Used for algorithm step tracking

### 9.6 Focus Indicators

**Focus Halo:**
- Hand-drawn circle around current element
- Stroke: Dashed or dotted
- Color: Highlight color (yellow/orange)
- Pulsing animation (optional): Opacity 0.6-1.0, 1s cycle

**Compare Marks:**
- Small ticks (✓ or ✗) next to compared values
- Hand-drawn, slightly imperfect
- Color: Green (match) or Red (mismatch)

### 9.7 Warning Annotations

**Invariant Warning:**
- Red pencil effect (still pencil-like, not UI badge)
- Hand-drawn warning symbol (⚠ or !)
- Wavy underline or circle around problematic element
- Margin note explaining issue

**Error Mark:**
- Hand-drawn X or circle with line
- Red color
- Positioned near error location

---

## 10. Voice Mode → Pencil Actions Mapping

### 10.1 Command Categories

**Structure Creation:**
- "Draw array A of size 8"
  → Pencil moves to position
  → Draws 8 boxes sequentially
  → Writes indices above
  → Writes label "A" nearby

**Value Updates:**
- "Set A[3] = 7"
  → Pencil moves to cell A[3]
  → Erases old value (if exists)
  → Writes "7" in cell

**Deletion:**
- "Cross out node X"
  → Pencil moves to node X
  → Draws strike-through scribble
  → Optionally erases node after delay

**Cutting:**
- "Cut this subtree"
  → Pencil draws cut line (zig-zag) across subtree
  → System splits group
  → Visual separation (gap appears)
  → Subtree becomes draggable

**Recursion:**
- "Show recursion for function f"
  → On each call: Pencil draws open-top recursion frame
  → Writes function signature in frame
  → Updates frame content as recursion progresses
  → On return: Writes return value, fades frame

**Pointer Movement:**
- "Move pointer to next"
  → Pencil erases old pointer arrow
  → Draws new pointer arrow at new position

**Highlighting:**
- "Highlight the current element"
  → Pencil switches to highlight mode
  → Draws highlight stroke over element
  → Switches back to draw mode

### 10.2 Voice Command Grammar

```typescript
interface VoiceCommand {
  action: CommandAction;
  target: CommandTarget;
  parameters: { [key: string]: any };
}

enum CommandAction {
  CREATE,        // Create new structure
  UPDATE,        // Update value
  DELETE,        // Delete element
  MOVE,          // Move pointer/iterator
  CONNECT,       // Connect nodes
  CUT,           // Cut region
  HIGHLIGHT,     // Highlight element
  SHOW_RECURSION, // Show recursion frame
  STEP,          // Execute algorithm step
  BACKSTEP       // Undo step
}

interface CommandTarget {
  type: 'node' | 'edge' | 'group' | 'value' | 'pointer';
  identifier: string;  // Node ID, variable name, etc.
  position?: { x: number; y: number };
}
```

**Example Parsing:**
- "Draw array A of size 8"
  → `{ action: CREATE, target: { type: 'node', identifier: 'A' }, parameters: { type: 'array', size: 8 } }`

- "Set A[3] = 7"
  → `{ action: UPDATE, target: { type: 'value', identifier: 'A[3]' }, parameters: { value: 7 } }`

### 10.3 Pencil Action Generation

**For Each Voice Command:**
1. Parse command into semantic action
2. Determine target location (from context or explicit)
3. Generate pencil movement path
4. Generate stroke script for visual change
5. Execute with pencil actor animation

**Context Awareness:**
- "Add 5 here" → "here" refers to last mentioned element
- "Move it" → "it" refers to currently selected element
- System maintains context stack for pronoun resolution

---

## 11. Performance and Scale

### 11.1 Stroke Caching

**Caching Strategy:**
- Once a stroke is drawn, it becomes a "baked layer"
- Baked strokes are rendered as static paths (not re-animated)
- Only edited regions are re-animated
- Cache invalidation: On node/edge update, invalidate affected strokes

**Cache Structure:**
```typescript
interface StrokeCache {
  nodeId: string;
  strokePaths: Path2D[];          // Baked stroke paths
  boundingBox: BoundingBox;
  lastUpdate: number;
  isValid: boolean;
}
```

### 11.2 Collapse (Paper Folding)

**Visual:**
- When subtree/group collapses:
  - Pencil draws small folded-corner icon
  - Region replaced with compact handwritten summary
  - Summary: Key information in condensed form

**Summary Format:**
- For trees: "[Tree: 15 nodes, height 4]"
- For arrays: "[Array: 8 elements, sum=42]"
- Handwritten, small font (8-10px)

**Expand:**
- On expand, pencil redraws full structure
- Animation: Unfold effect (corner icon fades, structure draws in)

### 11.3 Progressive Detail (Zoom-Based)

**Zoom Levels:**
- **Zoomed Out (< 50%):**
  - Show only structure outline (boxes, basic shapes)
  - Hide text labels
  - Hide fine details

- **Normal (50-150%):**
  - Show full structure
  - Show all labels
  - Show annotations

- **Zoomed In (> 150%):**
  - Show fine details
  - Show stroke imperfections
  - Show pencil texture

**LOD (Level of Detail) Switching:**
- On zoom change, regenerate stroke plan for appropriate LOD
- Smooth transition (fade out old, fade in new)

### 11.4 Large Structure Handling

**For Structures > 100 Elements:**
- Draw summary first (collapsed view)
- On interaction, expand relevant region
- Lazy loading: Load details on demand
- Virtual scrolling: Only render visible region

---

## 12. Demo Scripts

### 12.1 Two-Sum with Array and Pointers

**Setup:**
1. Pencil draws array `nums = [2, 7, 11, 15]` (4 boxes, handwritten values)
2. Pencil writes target `target = 9` above array
3. Pencil draws two pointer arrows: `left` → first cell, `right` → last cell

**Step 1: Compare**
- Pencil moves to `nums[left]` (value 2)
- Pencil moves to `nums[right]` (value 15)
- Pencil writes calculation: "2 + 15 = 17"
- Pencil writes comparison: "17 > 9" with checkmark
- Pencil highlights `right` pointer

**Step 2: Move Right Pointer**
- Pencil erases old `right` arrow
- Pencil draws new `right` arrow pointing to cell with value 11
- Pencil writes annotation: "Decrease right"

**Step 3: Compare Again**
- Pencil writes: "2 + 11 = 13"
- Pencil writes: "13 > 9" with checkmark
- Pencil moves `right` pointer again

**Step 4: Found**
- Pencil writes: "2 + 7 = 9"
- Pencil writes: "9 == 9" with double checkmark
- Pencil circles both `left` and `right` positions
- Pencil writes result: "Answer: [0, 1]" in margin

**Stroke Script Summary:**
- Total strokes: ~45 (array drawing, pointer movements, annotations)
- Duration: ~8-10 seconds
- Pencil mode switches: DRAW → WRITE → HIGHLIGHT → WRITE

### 12.2 Linked List Cycle Detection (Slow/Fast Pointers)

**Setup:**
1. Pencil draws linked list: 5 nodes connected with arrows
2. Pencil creates cycle: Last node points back to node 2
3. Pencil writes labels: `head`, `slow`, `fast`

**Step 1: Initialize**
- Pencil draws `slow` pointer arrow at `head`
- Pencil draws `fast` pointer arrow at `head.next`
- Pencil writes annotation: "slow = head, fast = head.next"

**Step 2: Move Pointers**
- Pencil erases old `slow` arrow
- Pencil draws new `slow` arrow (one step forward)
- Pencil erases old `fast` arrow
- Pencil draws new `fast` arrow (two steps forward)
- Pencil writes: "slow = slow.next, fast = fast.next.next"

**Step 3: Check Meeting**
- Pencil compares `slow` and `fast` positions
- Pencil writes: "slow != fast" with X mark
- Pencil continues loop

**Step 4: Cycle Detected**
- Pencil detects `slow == fast`
- Pencil circles both pointers
- Pencil writes: "Cycle detected!" with exclamation
- Pencil highlights cycle path with wavy line

**Visual Elements:**
- Slow pointer: Blue arrow, moves 1 step at a time
- Fast pointer: Red arrow, moves 2 steps at a time
- Meeting point: Highlighted with focus halo

### 12.3 BST Insert and Delete with Rotations

**Setup:**
1. Pencil draws initial BST (5 nodes)
2. Pencil writes values in nodes
3. Pencil draws edges (parent-child connections)

**Insert Operation:**
**Step 1: Find Insertion Point**
- Pencil starts at root
- Pencil compares new value (e.g., 6) with current node
- Pencil moves down tree (left/right based on comparison)
- Pencil writes comparison notes in margin

**Step 2: Insert Node**
- Pencil draws new node at leaf position
- Pencil writes value in node
- Pencil draws edge from parent to new node
- Pencil writes annotation: "Inserted 6"

**Delete Operation:**
**Step 1: Find Node**
- Pencil locates node to delete (e.g., 5)
- Pencil highlights node with circle

**Step 2: Case 1 - Leaf Node**
- If leaf: Pencil crosses out node
- Pencil erases edge from parent
- Pencil erases node

**Step 3: Case 2 - One Child**
- Pencil draws replacement child
- Pencil erases deleted node
- Pencil redraws edge from parent to child

**Step 4: Case 3 - Two Children (Rotation)**
- Pencil finds successor (right subtree minimum)
- Pencil highlights successor
- Pencil draws rotation arrows (curved, showing movement)
- Pencil erases old positions
- Pencil redraws nodes in new positions
- Pencil redraws edges
- Pencil writes annotation: "Rotated to maintain BST property"

**Rotation Visualization:**
- Old positions: Faded/erased
- New positions: Redrawn with pencil
- Arrows show movement direction
- Annotation explains rotation type (left/right)

### 12.4 Segment Tree Range Update with Lazy Tags

**Setup:**
1. Pencil draws segment tree structure (binary tree)
2. Pencil writes range labels at each node: "[0, 7]", "[0, 3]", etc.
3. Pencil writes values in nodes
4. Pencil draws tree edges

**Update Operation:**
**Step 1: Identify Range**
- Pencil highlights range to update (e.g., [2, 5])
- Pencil writes: "Update range [2, 5] with value +3"

**Step 2: Traverse Tree**
- Pencil starts at root
- Pencil compares query range with node range
- Pencil writes comparison notes
- Pencil moves to relevant children

**Step 3: Apply Lazy Tag**
- When node range is completely within query range:
  - Pencil writes lazy tag in corner of node (small text: "lazy: +3")
  - Pencil shades node slightly (to indicate pending update)
  - Pencil writes annotation: "Lazy tag applied"

**Step 4: Propagate Lazy Tags**
- On query, pencil propagates lazy tags down
- Pencil erases old lazy tags
- Pencil writes new lazy tags at children
- Pencil updates node values
- Pencil writes: "Lazy tags propagated"

**Visual Details:**
- Lazy tags: Small handwritten notes in top-right corner of nodes
- Font size: 8px
- Color: Orange or blue (distinct from values)
- Shading: Light pencil shading (opacity 0.2) over tagged nodes

### 12.5 Dijkstra with Distance Table

**Setup:**
1. Pencil draws graph: 6 nodes with weighted edges
2. Pencil writes node labels: A, B, C, D, E, F
3. Pencil writes edge weights along edges
4. Pencil draws distance table: 2-column table (Node | Distance)

**Step 1: Initialize**
- Pencil writes distance table header
- Pencil writes initial distances:
  - A: 0 (source)
  - Others: ∞ (handwritten infinity symbol)
- Pencil highlights source node A

**Step 2: Relax Edges from A**
- Pencil examines edges from A
- Pencil writes: "Relax (A, B): 0 + 4 = 4"
- Pencil updates distance table: B: ∞ → 4
- Pencil crosses out old value, writes new value
- Pencil repeats for other edges from A

**Step 3: Select Minimum**
- Pencil circles minimum distance in table (B: 4)
- Pencil highlights node B
- Pencil writes: "Select B (min distance)"

**Step 4: Relax from B**
- Pencil examines edges from B
- Pencil updates distances for neighbors
- Pencil writes relaxation calculations in margin

**Step 5: Continue**
- Pencil repeats steps 3-4 for remaining nodes
- Pencil marks visited nodes (small checkmark)
- Pencil updates distance table progressively

**Step 6: Final Result**
- Pencil highlights final distances in table
- Pencil draws shortest path tree (highlighted edges)
- Pencil writes: "Shortest paths found" in margin

**Visual Elements:**
- Distance table: Hand-drawn table, updated in real-time
- Relaxation calculations: Handwritten in margin
- Visited nodes: Checkmarks or circles
- Shortest path: Highlighted edges with thicker strokes

---

## 13. Implementation Guidelines

### 13.1 Stroke Rendering Engine

**Technology Options:**
- Canvas 2D API: Best for stroke rendering, good performance
- SVG: Better for interactivity, easier text handling
- Hybrid: Canvas for strokes, SVG for text and handles

**Recommendation: Canvas 2D**
- Better performance for many strokes
- More control over stroke rendering
- Can implement custom stroke styles easily

### 13.2 React Flow Integration

**Custom Node Renderer:**
- Override React Flow's default node renderer
- Render semantic layer (invisible or very faint)
- Render sketch layer on top (Canvas overlay)

**Event Handling:**
- React Flow handles selection, dragging, connections
- Sketch layer handles visual rendering only
- Coordinate mapping between layers

### 13.3 Pencil Actor Implementation

**Animation System:**
- Use requestAnimationFrame for smooth animation
- Interpolate pencil position between keyframes
- Render pencil cursor on separate layer (always on top)

**State Management:**
- Pencil state stored in React state
- Updates trigger re-render of pencil cursor
- Stroke scripts executed sequentially with timing

### 13.4 Performance Optimization

**Stroke Batching:**
- Batch multiple strokes in single render call
- Use Path2D for stroke caching
- Minimize canvas redraws

**LOD System:**
- Pre-calculate stroke plans for different zoom levels
- Switch LOD based on zoom level
- Cache LOD stroke plans

**Virtual Rendering:**
- Only render visible region
- Use viewport culling
- Lazy load off-screen strokes

---

## 14. Testing Requirements

### 14.1 Visual Tests

**Stroke Quality:**
- Verify strokes look hand-drawn (not perfect)
- Check jitter and wobble are applied
- Verify pressure variation affects stroke width

**Animation Smoothness:**
- Pencil movement should be smooth (60fps)
- No jank or stuttering
- Natural acceleration/deceleration

**Realism:**
- Compare output to actual notebook sketches
- User testing: Does it feel hand-drawn?

### 14.2 Functional Tests

**Gesture Recognition:**
- Test all gesture types
- Verify recognition accuracy (>90%)
- Test edge cases (ambiguous gestures)

**Step Engine:**
- Test forward/backward stepping
- Test branching
- Verify state consistency

**Voice Commands:**
- Test command parsing
- Verify pencil actions match commands
- Test context resolution ("here", "it", etc.)

### 14.3 Performance Tests

**Large Structures:**
- Test with 100+ nodes
- Verify rendering performance (60fps)
- Test collapse/expand performance

**Stroke Count:**
- Test with 1000+ strokes
- Verify caching works
- Test memory usage

---

## 15. Future Enhancements

### 15.1 Advanced Features

**Multi-User Collaboration:**
- Multiple pencil cursors (different colors)
- Real-time stroke synchronization
- Conflict resolution for simultaneous edits

**Export Options:**
- Export as PDF (maintains notebook look)
- Export as SVG (editable)
- Export as image (PNG/JPG)

**Customization:**
- User-defined handwriting styles
- Custom paper textures
- Custom pencil colors

### 15.2 AI Enhancements

**Smart Suggestions:**
- AI suggests next steps
- AI detects common patterns
- AI offers optimizations

**Auto-Complete:**
- AI completes partial drawings
- AI suggests structure improvements
- AI fixes common mistakes

---

## Appendix A: Stroke Script Reference

### A.1 Complete Stroke Type Catalog

See section 3.1 for stroke type definitions.

### A.2 Stroke Style Presets

**Default Pencil:**
```json
{
  "width": 1.0,
  "color": "#2C2C2C",
  "opacity": 0.9,
  "cap": "round",
  "join": "round"
}
```

**Highlight:**
```json
{
  "width": 8.0,
  "color": "#FFEB3B",
  "opacity": 0.3,
  "cap": "round",
  "join": "round"
}
```

**Eraser:**
```json
{
  "width": 10.0,
  "color": "#FFFFFF",
  "opacity": 0.9,
  "cap": "round",
  "join": "round"
}
```

---

## Appendix B: Data Structure Catalog

### B.1 Linear Structures
- Array, Dynamic Array, Linked List, Doubly Linked List, Stack, Queue, Deque

### B.2 Hash Structures
- Hash Table, Hash Set, Hash Map, Bloom Filter

### B.3 Tree Structures
- Binary Tree, BST, AVL Tree, Red-Black Tree, B-Tree, Trie, Suffix Tree, Segment Tree, Fenwick Tree

### B.4 Graph Structures
- Directed Graph, Undirected Graph, Weighted Graph, Adjacency List, Adjacency Matrix

### B.5 Range Structures
- Segment Tree, Fenwick Tree, Sparse Table, Range Tree

### B.6 String Structures
- Trie, Suffix Tree, Suffix Array, KMP Automaton

### B.7 Persistent Structures
- Persistent Array, Persistent Segment Tree

### B.8 Probabilistic Structures
- Bloom Filter, Count-Min Sketch, HyperLogLog

Each structure has a defined stroke plan (see section 7).

---

## Document Status

**Version:** 1.0  
**Date:** 2024  
**Status:** Complete Specification  
**Next Steps:** Implementation planning and architecture design

---

**End of Specification**

