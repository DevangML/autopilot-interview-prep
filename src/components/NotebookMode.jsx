/**
 * Notebook Mode Component
 * Main component for hand-drawn notebook-style visualization
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  addEdge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { PencilActor, PencilMode } from '../core/pencilActor.js';
import { StrokeRenderer } from '../core/strokeRenderer.js';
import { StrokeScriptGenerator } from '../core/strokeScriptGenerator.js';
import { GestureRecognizer } from '../core/gestureRecognizer.js';
import { StepEngine } from '../core/stepEngine.js';
import { VoiceCommandParser } from '../core/voiceCommandParser.js';
import { notebookNodeTypes } from './NotebookNodes.jsx';
import { Mic, MicOff, Save, Loader2, Edit3 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { saveDryRunNote } from '../services/dataStore.js';
import { useVoskSpeech } from '../hooks/useVoskSpeech.js';
import { FileSystemHelper } from '../services/advancedWebFeatures.js';

const PaperMode = {
  RULED: 'ruled',
  GRID: 'grid',
  BLANK: 'blank'
};

export default function NotebookMode({ onVoiceCommand, handwritingProfile = {}, itemId, domain, onClose }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [paperMode, setPaperMode] = useState(PaperMode.RULED);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteName, setNoteName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);

  const canvasRef = useRef(null);
  const sketchCanvasRef = useRef(null);
  const pencilActorRef = useRef(null);
  const strokeRendererRef = useRef(null);
  const scriptGeneratorRef = useRef(null);
  const gestureRecognizerRef = useRef(null);
  const stepEngineRef = useRef(null);
  const voiceParserRef = useRef(null);
  const strokeCacheRef = useRef(new Map());
  const isDrawingRef = useRef(false);
  const handleVoiceCommandRef = useRef(null);
  const isMountedRef = useRef(true);
  const flowRef = useRef(null);

  // Local Vosk REAL-TIME speech recognition (100% offline, free)
  const {
    isListening,
    isLoading: isModelLoading,
    transcript,
    partialTranscript,
    error: speechError,
    loadingProgress,
    toggleListening: toggleVoskListening,
  } = useVoskSpeech({
    processPartials: true,
    onPartialTranscript: (fullText, newWords) => {
      // Process commands in real-time as user speaks
      if (newWords && voiceParserRef.current) {
        const parsed = voiceParserRef.current.parse(newWords);
        if (parsed) {
          handleVoiceCommandRef.current?.(parsed);
        }
      }
    },
    onFinalTranscript: (text) => {
      // Full command after pause - can re-process for accuracy
      if (text.trim() && voiceParserRef.current) {
        console.log('[NotebookMode] Final transcript:', text);
      }
    },
  });

  // Initialize systems
  useEffect(() => {
    // Initialize pencil actor
    pencilActorRef.current = new PencilActor({
      position: { x: 100, y: 100 },
      mode: PencilMode.POINT
    });

    // Initialize stroke renderer
    if (sketchCanvasRef.current) {
      strokeRendererRef.current = new StrokeRenderer(
        sketchCanvasRef.current,
        handwritingProfile
      );
      
      // Render paper background
      strokeRendererRef.current.renderPaperBackground(paperMode);
    }

    // Initialize script generator
    scriptGeneratorRef.current = new StrokeScriptGenerator(handwritingProfile);

    // Initialize gesture recognizer
    gestureRecognizerRef.current = new GestureRecognizer();

    // Initialize step engine
    stepEngineRef.current = new StepEngine();

    // Initialize voice command parser
    voiceParserRef.current = new VoiceCommandParser();

    // Subscribe to pencil state changes
    const unsubscribe = pencilActorRef.current.subscribe((pencilState) => {
      // Update pencil cursor visual
      renderPencilCursor(pencilState);
    });

    return () => {
      unsubscribe();
      pencilActorRef.current?.stop();
    };
  }, [paperMode, handwritingProfile]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);


  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (sketchCanvasRef.current && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        sketchCanvasRef.current.width = rect.width;
        sketchCanvasRef.current.height = rect.height;
        
        if (strokeRendererRef.current) {
          strokeRendererRef.current.renderPaperBackground(paperMode);
          // Re-render all cached strokes
          renderCachedStrokes();
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [paperMode]);

  /**
   * Render pencil cursor on canvas
   */
  const renderPencilCursor = useCallback((pencilState) => {
    if (!sketchCanvasRef.current || !strokeRendererRef.current) return;

    const ctx = sketchCanvasRef.current.getContext('2d');
    const { position, mode, pressure } = pencilState;

    // Clear previous cursor (or use a separate cursor layer)
    // For now, we'll just draw the cursor
    ctx.save();
    
    // Draw pencil icon based on mode
    const size = mode === PencilMode.POINT ? 16 : 20;
    ctx.fillStyle = mode === PencilMode.ERASE ? '#FF69B4' : '#2C2C2C';
    ctx.beginPath();
    ctx.arc(position.x, position.y, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw pressure indicator ring
    if (mode !== PencilMode.POINT) {
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(position.x, position.y, size / 2 + pressure * 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }, []);

  /**
   * Execute a stroke script and render it
   */
  const executeStrokeScript = useCallback(async (strokeScript) => {
    if (!pencilActorRef.current || !strokeRendererRef.current) return;

    // Clear previous pencil cursor area
    const ctx = sketchCanvasRef.current.getContext('2d');
    const clearRadius = 30;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,1)';
    ctx.beginPath();
    ctx.arc(
      pencilActorRef.current.state.position.x,
      pencilActorRef.current.state.position.y,
      clearRadius,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Execute script with pencil actor
    await pencilActorRef.current.executeStrokeScript(strokeScript, (progress) => {
      // Render stroke progress
      const stroke = progress.stroke;
      
      switch (progress.type) {
        case 'path':
        case 'scribble':
          strokeRendererRef.current.renderStroke(stroke, progress.progress);
          break;
        case 'text':
          strokeRendererRef.current.renderText(stroke, progress.progress);
          break;
      }
    });

    // Cache completed stroke
    strokeCacheRef.current.set(strokeScript.id, strokeScript);
  }, []);

  /**
   * Render all cached strokes
   */
  const renderCachedStrokes = useCallback(() => {
    if (!strokeRendererRef.current) return;

    strokeCacheRef.current.forEach((strokeScript) => {
      strokeScript.strokes.forEach((stroke) => {
        switch (stroke.type) {
          case 'RECTANGLE':
            strokeRendererRef.current.renderRectangle(stroke, 1.0);
            break;
          case 'TEXT':
            strokeRendererRef.current.renderText(stroke, 1.0);
            break;
          case 'ARROW':
            strokeRendererRef.current.renderArrow(stroke, 1.0);
            break;
          default:
            strokeRendererRef.current.renderStroke(stroke, 1.0);
        }
      });
    });
  }, []);

  /**
   * Generate and execute stroke script for a node
   */
  const renderNodeAsSketch = useCallback(async (node) => {
    if (!scriptGeneratorRef.current) return;

    let strokeScript = null;

    // Generate stroke script based on node type
    switch (node.type) {
      case 'array':
        strokeScript = scriptGeneratorRef.current.generateArrayScript(
          node.data,
          { x: node.position.x, y: node.position.y }
        );
        break;
      case 'recursionFrame':
        strokeScript = scriptGeneratorRef.current.generateRecursionFrameScript(
          node.data,
          { x: node.position.x, y: node.position.y }
        );
        break;
      default:
        // Default: draw as rectangle
        strokeScript = scriptGeneratorRef.current.generateArrayScript(
          { elements: [], label: node.data?.label || 'Node' },
          { x: node.position.x, y: node.position.y }
        );
    }

    if (strokeScript) {
      await executeStrokeScript(strokeScript);
    }
  }, [executeStrokeScript]);


  /**
   * Handle voice command
   */
  const handleVoiceCommand = useCallback(async (parsed) => {
    if (!scriptGeneratorRef.current || !pencilActorRef.current || !stepEngineRef.current) return;

    // Execute based on action
    switch (parsed.action) {
        case 'CREATE':
          await handleCreateAction(parsed);
          break;
        case 'UPDATE':
          await handleUpdateAction(parsed);
          break;
        case 'DELETE':
          await handleDeleteAction(parsed);
          break;
        case 'MOVE':
          await handleMoveAction(parsed);
          break;
        case 'CONNECT':
          await handleConnectAction(parsed);
          break;
        case 'CUT':
          await handleCutAction(parsed);
          break;
        case 'HIGHLIGHT':
          await handleHighlightAction(parsed);
          break;
        case 'SHOW_RECURSION':
          await handleRecursionAction(parsed);
          break;
        case 'STEP':
          await stepEngineRef.current.nextStep(async (step) => {
            if (step.strokeScript) {
              for (const script of step.strokeScript) {
                await executeStrokeScript(script);
              }
            }
          });
          setIsDrawing(!isDrawing);
          break;
        case 'BACKSTEP':
          await stepEngineRef.current.backstep(async (step, direction, mode) => {
            // Reverse stroke execution
          });
          setIsDrawing(!isDrawing);
          break;
      }
  }, [nodes, executeStrokeScript, setNodes, setIsDrawing]);

  useEffect(() => {
    handleVoiceCommandRef.current = handleVoiceCommand;
  }, [handleVoiceCommand]);



  const handleCreateAction = async (parsed) => {
    const { target, parameters } = parsed;
    const elements = parameters.type === 'array' 
      ? new Array(parameters.size || 0).fill(null)
      : [];

    const newNode = {
      id: `${target.identifier}_${Date.now()}`,
      type: parameters.type === 'array' ? 'notebookArray' : 'notebookHashmap',
      position: { x: 100 + Math.random() * 100, y: 100 + Math.random() * 100 },
      data: { 
        elements, 
        label: target.identifier,
        ...parameters
      }
    };

    setNodes((nds) => [...nds, newNode]);
    
    // Generate and execute stroke script
    const strokeScript = scriptGeneratorRef.current.generateArrayScript(
      { elements, label: target.identifier },
      newNode.position
    );

    await executeStrokeScript(strokeScript);

    // Add step
    stepEngineRef.current.addStep({
      semanticDelta: { nodesAdded: [newNode] },
      strokeScript: [strokeScript],
      description: `Created ${parameters.type} ${target.identifier}`
    });

    setIsDrawing(!isDrawing);
  };

  const handleUpdateAction = async (parsed) => {
    const { target, parameters } = parsed;
    // Implementation for update actions
  };

  const handleDeleteAction = async (parsed) => {
    const { target } = parsed;
    // Implementation for delete actions
  };

  const handleMoveAction = async (parsed) => {
    const { target, parameters } = parsed;
    // Implementation for move actions
  };

  const handleConnectAction = async (parsed) => {
    const { parameters } = parsed;
    // Implementation for connect actions
  };

  const handleCutAction = async (parsed) => {
    const { target } = parsed;
    // Implementation for cut actions
  };

  const handleHighlightAction = async (parsed) => {
    const { target } = parsed;
    // Implementation for highlight actions
  };

  const handleRecursionAction = async (parsed) => {
    const { target, parameters } = parsed;
    const frameData = {
      functionName: target.identifier,
      parameters: parameters || {}
    };

    const newNode = {
      id: `recur_${target.identifier}_${Date.now()}`,
      type: 'notebookRecursionFrame',
      position: { x: 100, y: 200 },
      data: frameData
    };

    setNodes((nds) => [...nds, newNode]);

    const strokeScript = scriptGeneratorRef.current.generateRecursionFrameScript(
      frameData,
      newNode.position
    );

    await executeStrokeScript(strokeScript);

    stepEngineRef.current.addStep({
      semanticDelta: { nodesAdded: [newNode] },
      strokeScript: [strokeScript],
      description: `Called ${target.identifier}(${Object.values(parameters || {}).join(', ')})`
    });

    setIsDrawing(!isDrawing);
  };

  /**
   * Handle gesture recognition
   */
  const handleGesture = useCallback((gesture) => {
    // Gesture recognition would be implemented here
    // For now, this is a placeholder
    console.log('Gesture detected:', gesture);
  }, []);

  /**
   * Generate note name with date suffix
   */
  const generateNoteName = useCallback(() => {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    const domainPart = domain ? `${domain}_` : '';
    const itemPart = itemId ? `item-${itemId}_` : '';
    const baseName = noteName.trim() || 'notebook';
    
    return `${domainPart}${itemPart}${baseName}_${dateStr}_${timeStr}`;
  }, [noteName, domain, itemId]);

  /**
   * Save note to database and file system
   */
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Capture screenshot
      let screenshotUrl = null;
      if (sketchCanvasRef.current) {
        const canvas = sketchCanvasRef.current;
        const dataUrl = canvas.toDataURL('image/png');
        screenshotUrl = dataUrl;
      }

      // Prepare note content
      const content = {
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data
        })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle
        })),
        steps: stepEngineRef.current?.getAllSteps() || [],
        strokeCache: Array.from(strokeCacheRef.current.entries()).map(([id, script]) => ({
          id,
          script
        })),
        paperMode,
        handwritingProfile
      };

      // Generate note name with date suffix
      const noteTitle = noteName.trim() || generateNoteName();
      const noteFileName = generateNoteName();

      // Save to database
      const saved = await saveDryRunNote({
        itemId: itemId || null,
        domain: domain || null,
        title: noteTitle,
        type: 'notebook_mode',
        content,
        screenshotUrl
      });

      // Prepare note data for file
      const noteData = {
        id: saved.id,
        itemId,
        domain,
        title: noteTitle,
        type: 'notebook_mode',
        content,
        screenshotUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Save to file system using File System Access API (with fallback to download)
      const result = await FileSystemHelper.saveFile(
        noteData,
        `${noteFileName}.json`,
        'application/json'
      );
      
      if (!result.success && !result.fallback) {
        console.warn('[NotebookMode] File system save failed, using fallback');
        // Fallback to download
        const blob = new Blob([JSON.stringify(noteData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${noteFileName}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      alert(`Note "${noteTitle}" saved successfully!`);
      setShowNameInput(false);
      setNoteName('');
    } catch (error) {
      console.error('[NotebookMode] Save error:', error);
      alert('Failed to save note: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, paperMode, handwritingProfile, itemId, domain, isSaving, noteName, generateNoteName]);

  return (
    <div className="notebook-mode" style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* React Flow - Semantic Layer (invisible or very faint) */}
      <div
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          opacity: 0.05 // Very faint for debugging, can be 0 in production
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={(params) => setEdges((eds) => addEdge(params, eds))}
          nodeTypes={notebookNodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      {/* Canvas - Sketch Layer (visible) */}
      <canvas
        ref={sketchCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 10
        }}
      />

      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 20,
          background: 'white',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px'
        }}
      >
        <div style={{ display: 'flex', gap: '5px' }}>
          <button
            onClick={() => setPaperMode(PaperMode.RULED)}
            style={{
              padding: '5px 10px',
              background: paperMode === PaperMode.RULED ? '#4A90E2' : '#f0f0f0',
              color: paperMode === PaperMode.RULED ? 'white' : 'black',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Ruled
          </button>
          <button
            onClick={() => setPaperMode(PaperMode.GRID)}
            style={{
              padding: '5px 10px',
              background: paperMode === PaperMode.GRID ? '#4A90E2' : '#f0f0f0',
              color: paperMode === PaperMode.GRID ? 'white' : 'black',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Grid
          </button>
          <button
            onClick={() => setPaperMode(PaperMode.BLANK)}
            style={{
              padding: '5px 10px',
              background: paperMode === PaperMode.BLANK ? '#4A90E2' : '#f0f0f0',
              color: paperMode === PaperMode.BLANK ? 'white' : 'black',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Blank
          </button>
        </div>
        <button
          onClick={toggleVoskListening}
          disabled={isModelLoading}
          style={{
            padding: '8px 12px',
            background: isListening ? '#FF6B6B' : '#4A90E2',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: isModelLoading ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          {isListening ? <MicOff size={14} /> : <Mic size={14} />}
          {isListening ? 'Stop' : 'Start'} Voice
        </button>
        {transcript && (
          <div style={{ fontSize: '11px', color: '#666', maxWidth: '200px', wordBreak: 'break-word' }}>
            {transcript}
          </div>
        )}
        {isModelLoading && (
          <div style={{ fontSize: '11px', color: '#4A90E2', maxWidth: '200px' }}>
            Loading model: {loadingProgress}%
          </div>
        )}
        {speechError && (
          <div style={{ fontSize: '11px', color: '#FF6B6B', maxWidth: '200px' }}>
            {speechError}
          </div>
        )}
        {partialTranscript && (
          <div style={{ fontSize: '11px', color: '#666', maxWidth: '200px', fontStyle: 'italic' }}>
            {partialTranscript}
          </div>
        )}
        {showNameInput ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <input
              type="text"
              value={noteName}
              onChange={(e) => setNoteName(e.target.value)}
              placeholder="Note name (optional)"
              style={{
                padding: '5px',
                border: '1px solid #ccc',
                borderRadius: '3px',
                fontSize: '12px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSave();
                } else if (e.key === 'Escape') {
                  setShowNameInput(false);
                  setNoteName('');
                }
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={handleSave}
                disabled={isSaving}
                style={{
                  padding: '5px 10px',
                  background: isSaving ? '#ccc' : '#4A90E2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  fontSize: '11px',
                  flex: 1
                }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowNameInput(false);
                  setNoteName('');
                }}
                style={{
                  padding: '5px 10px',
                  background: '#f0f0f0',
                  color: 'black',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNameInput(true)}
            disabled={isSaving}
            style={{
              padding: '8px 12px',
              background: isSaving ? '#ccc' : '#4A90E2',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Save size={14} />
            {isSaving ? 'Saving...' : 'Save Note'}
          </button>
        )}
      </div>

      {/* Timeline Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          zIndex: 20,
          background: 'white',
          padding: '10px',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
        }}
      >
        <button
          onClick={async () => {
            if (stepEngineRef.current) {
              await stepEngineRef.current.backstep(async (step, direction, mode) => {
                // Reverse stroke script execution
                if (step.strokeScript) {
                  for (const script of step.strokeScript.reverse()) {
                    // Erase or fade strokes based on mode
                    if (mode === 'erase') {
                      // Erase strokes (implement erase logic)
                    } else {
                      // Fade strokes
                    }
                  }
                }
                // Reverse semantic delta
                if (step.semanticDelta) {
                  // Undo React Flow changes
                }
              });
              // Force re-render
              setIsDrawing(!isDrawing);
            }
          }}
          disabled={!stepEngineRef.current || stepEngineRef.current.getCurrentStepIndex() < 0}
          style={{
            margin: '5px',
            padding: '5px 10px',
            border: 'none',
            borderRadius: '3px',
            cursor: (!stepEngineRef.current || stepEngineRef.current.getCurrentStepIndex() < 0) ? 'not-allowed' : 'pointer',
            background: '#f0f0f0'
          }}
        >
          ← Back
        </button>
        <span style={{ margin: '0 10px' }}>
          Step {stepEngineRef.current ? stepEngineRef.current.getCurrentStepIndex() + 1 : 0} / {stepEngineRef.current ? stepEngineRef.current.getTotalSteps() : 0}
        </span>
        <button
          onClick={async () => {
            if (stepEngineRef.current) {
              await stepEngineRef.current.nextStep(async (step, direction) => {
                // Execute stroke scripts
                if (step.strokeScript) {
                  for (const script of step.strokeScript) {
                    await executeStrokeScript(script);
                  }
                }
                // Apply semantic delta
                if (step.semanticDelta) {
                  // Apply React Flow changes
                }
              });
              // Force re-render
              setIsDrawing(!isDrawing);
            }
          }}
          disabled={!stepEngineRef.current || stepEngineRef.current.getCurrentStepIndex() >= stepEngineRef.current.getTotalSteps() - 1}
          style={{
            margin: '5px',
            padding: '5px 10px',
            border: 'none',
            borderRadius: '3px',
            cursor: (!stepEngineRef.current || stepEngineRef.current.getCurrentStepIndex() >= stepEngineRef.current.getTotalSteps() - 1) ? 'not-allowed' : 'pointer',
            background: '#f0f0f0'
          }}
        >
          Forward →
        </button>
      </div>
    </div>
  );
}
