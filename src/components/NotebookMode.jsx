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
import { Mic, MicOff, Save } from 'lucide-react';
import html2canvas from 'html2canvas';
import { saveDryRunNote } from '../services/dataStore.js';
import { downloadNoteAsFile } from '../utils/noteExporter.js';

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
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [speechError, setSpeechError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  
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
  const recognitionRef = useRef(null);
  const isListeningRef = useRef(false);
  const networkRetryTimeoutRef = useRef(null);
  const handleVoiceCommandRef = useRef(null);
  const isMountedRef = useRef(true);
  const scheduleNetworkRetryRef = useRef(null);
  const flowRef = useRef(null);

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

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

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

  // Handle listening state changes
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      const startTimeout = setTimeout(() => {
        if (!recognitionRef.current || !isMountedRef.current) return;

        try {
          recognitionRef.current.start();
          setSpeechError(null);
        } catch (error) {
          const message = (error?.message || error?.name || '').toLowerCase();
          if (error?.name === 'InvalidStateError' && message.includes('already started')) {
            setSpeechError(null);
            return;
          }

          if (message.includes('network')) {
            setSpeechError('Network error. Retrying...');
            scheduleNetworkRetryRef.current?.();
            return;
          }

          if (isMountedRef.current) {
            setSpeechError(`Failed to start: ${error?.message || error?.name}. Try refreshing the page.`);
            setIsListening(false);
          }
        }
      }, 100);

      return () => clearTimeout(startTimeout);
    }

    try {
      recognitionRef.current.stop();
      setSpeechError(null);
    } catch (error) {
      console.warn('[NotebookMode] Recognition stop failed', error);
    }
  }, [isListening]);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    const scheduleNetworkRetry = () => {
      if (!isMountedRef.current) return;

      if (networkRetryTimeoutRef.current) {
        clearTimeout(networkRetryTimeoutRef.current);
        networkRetryTimeoutRef.current = null;
      }

      networkRetryTimeoutRef.current = window.setTimeout(() => {
        networkRetryTimeoutRef.current = null;
        if (!isMountedRef.current || !isListeningRef.current) return;

        try {
          recognition.stop();
        } catch (stopError) {
          console.warn('[NotebookMode] Network retry stop failed', stopError);
        }

        setTimeout(() => {
          if (!isMountedRef.current || !isListeningRef.current) return;

          try {
            recognition.start();
            setSpeechError(null);
          } catch (startError) {
            const message = startError?.message?.toLowerCase() || '';
            if (message.includes('network')) {
              scheduleNetworkRetry();
            } else if (startError?.name !== 'InvalidStateError' && isMountedRef.current) {
              setSpeechError('Speech recognition unavailable. Try refreshing the page.');
              setIsListening(false);
            }
          }
        }, 500);
      }, 1000);
    };

    scheduleNetworkRetryRef.current = scheduleNetworkRetry;

    recognition.onstart = () => {
      console.log('[NotebookMode] Speech recognition started');
      if (isMountedRef.current) {
        setSpeechError(null);
      }
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        } else {
          interimTranscript += transcript;
        }
      }

      const latestTranscript = interimTranscript || finalTranscript;
      setTranscript(latestTranscript);

      if (finalTranscript.trim() && voiceParserRef.current) {
        const parsed = voiceParserRef.current.parse(finalTranscript.trim());
        if (parsed) {
          handleVoiceCommandRef.current?.(parsed);
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('[NotebookMode] Speech recognition error:', event.error);

      if (!isMountedRef.current) return;

      if (event.error === 'network') {
        if (isMountedRef.current) {
          setSpeechError('Network error. Retrying...');
        }
        scheduleNetworkRetry();
      } else if (event.error === 'not-allowed') {
        setSpeechError('Microphone permission denied.');
        if (isMountedRef.current) {
          setIsListening(false);
        }
      } else if (event.error === 'audio-capture') {
        setSpeechError('No microphone found. Please connect a microphone.');
        if (isMountedRef.current) {
          setIsListening(false);
        }
      } else if (event.error === 'service-not-allowed') {
        setSpeechError('Speech recognition service not allowed. Please check browser settings.');
        if (isMountedRef.current) {
          setIsListening(false);
        }
      } else if (event.error === 'aborted') {
        setSpeechError(null);
        if (isMountedRef.current) {
          setIsListening(false);
        }
      } else if (event.error === 'no-speech') {
        setSpeechError(null);
      } else {
        setSpeechError(`Speech error: ${event.error}`);
        if (isMountedRef.current) {
          setIsListening(false);
        }
      }
    };

    recognition.onend = () => {
      if (!isMountedRef.current || !isListeningRef.current) return;

      setTimeout(() => {
        if (!isMountedRef.current || !isListeningRef.current) return;

        try {
          recognition.start();
          setSpeechError(null);
        } catch (error) {
          if (error.name !== 'InvalidStateError' && isMountedRef.current) {
            setSpeechError('Failed to restart speech recognition. Try again.');
            setIsListening(false);
          }
        }
      }, 300);
    };

    recognitionRef.current = recognition;

    return () => {
      if (networkRetryTimeoutRef.current) {
        clearTimeout(networkRetryTimeoutRef.current);
        networkRetryTimeoutRef.current = null;
      }

      try {
        recognition.stop();
      } catch (stopError) {
        // Ignore cleanup errors
      }

      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      scheduleNetworkRetryRef.current = null;
    };
  }, []);

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
   * Save note to database and file
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

      // Save to database
      const saved = await saveDryRunNote({
        itemId: itemId || null,
        domain: domain || null,
        title: `Notebook Mode - ${new Date().toLocaleString()}`,
        type: 'notebook_mode',
        content,
        screenshotUrl
      });

      // Also download as file
      downloadNoteAsFile({
        id: saved.id,
        itemId,
        domain,
        title: `Notebook Mode - ${new Date().toLocaleString()}`,
        type: 'notebook_mode',
        content,
        screenshotUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      alert('Note saved successfully!');
    } catch (error) {
      console.error('[NotebookMode] Save error:', error);
      alert('Failed to save note: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  }, [nodes, edges, paperMode, handwritingProfile, itemId, domain, isSaving]);

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
          onClick={() => setIsListening(!isListening)}
          disabled={!recognitionRef.current}
          style={{
            padding: '8px 12px',
            background: isListening ? '#FF6B6B' : '#4A90E2',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: recognitionRef.current ? 'pointer' : 'not-allowed',
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
        {speechError && (
          <div style={{ fontSize: '11px', color: '#FF6B6B', maxWidth: '200px' }}>
            {speechError}
          </div>
        )}
        <button
          onClick={handleSave}
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
