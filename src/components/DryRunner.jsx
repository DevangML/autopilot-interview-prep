/**
 * Dry Runner - Voice-controlled DSA visualization
 * Uses React Flow for professional diagramming look
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Panel,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Mic, MicOff, Download, X, RotateCcw, Edit2, Save } from 'lucide-react';
import html2canvas from 'html2canvas';
import { understandVoiceCommand, getDataStructureColors } from '../services/dryRunnerAI.js';
import { saveDryRunnerCorrection, getDryRunnerCorrections, saveDryRunNote } from '../services/dataStore.js';
import { downloadNoteAsFile } from '../utils/noteExporter.js';

// Editable Array Node with individual cell editing
const ArrayNode = ({ data, selected }) => {
  const colors = getDataStructureColors();
  const elements = data.elements || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleCellClick = (index) => {
    setEditingIndex(index);
    setEditValue(elements[index]?.toString() || '');
  };

  const handleCellBlur = () => {
    if (editingIndex !== null) {
      const newElements = [...elements];
      const numValue = parseFloat(editValue);
      newElements[editingIndex] = isNaN(numValue) ? editValue : numValue;
      data.onUpdate?.({ elements: newElements });
      setEditingIndex(null);
    }
  };

  const handleAddCell = () => {
    const newElements = [...elements, ''];
    data.onUpdate?.({ elements: newElements });
  };

  return (
    <div
      style={{
        background: colors.array,
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        minWidth: '250px',
        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
        border: selected ? '3px solid #FFD700' : '2px solid rgba(255,255,255,0.2)'
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{data.label || 'Array'}</span>
        <span style={{ fontSize: '11px', opacity: 0.8 }}>[{elements.length}]</span>
      </div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {elements.map((el, idx) => (
          <div
            key={idx}
            onClick={() => handleCellClick(idx)}
            onBlur={handleCellBlur}
            style={{
              background: editingIndex === idx ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
              padding: '6px 10px',
              borderRadius: '4px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              minWidth: '40px',
              textAlign: 'center',
              border: editingIndex === idx ? '2px solid white' : 'none',
              position: 'relative'
            }}
            contentEditable={editingIndex === idx}
            suppressContentEditableWarning
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCellBlur();
              }
            }}
          >
            {editingIndex === idx ? (
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleCellBlur}
                autoFocus
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'white',
                  width: '100%',
                  textAlign: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  outline: 'none'
                }}
              />
            ) : (
              el
            )}
            {idx < elements.length - 1 && (
              <span style={{ marginLeft: '4px', opacity: 0.5 }}>→</span>
            )}
          </div>
        ))}
        <button
          onClick={handleAddCell}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px dashed rgba(255,255,255,0.5)',
            padding: '6px 10px',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          +
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// Editable HashMap Node
const HashmapNode = ({ data, selected }) => {
  const colors = getDataStructureColors();
  const entries = data.entries || {};
  const [editingKey, setEditingKey] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const handleEdit = (key) => {
    setEditingKey(key);
    setNewKey(key);
    setNewValue(entries[key]?.toString() || '');
  };

  const handleSave = () => {
    if (newKey && newValue !== '') {
      const newEntries = { ...entries };
      if (editingKey && editingKey !== newKey) {
        delete newEntries[editingKey];
      }
      const numValue = parseFloat(newValue);
      newEntries[newKey] = isNaN(numValue) ? newValue : numValue;
      data.onUpdate?.({ entries: newEntries });
      setEditingKey(null);
      setNewKey('');
      setNewValue('');
    }
  };

  const handleAdd = () => {
    setEditingKey('__new__');
    setNewKey('');
    setNewValue('');
  };

  const handleDelete = (key) => {
    const newEntries = { ...entries };
    delete newEntries[key];
    data.onUpdate?.({ entries: newEntries });
  };

  return (
    <div
      style={{
        background: colors.hashmap,
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        minWidth: '180px',
        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
        border: selected ? '3px solid #FFD700' : '2px solid rgba(255,255,255,0.2)'
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
        {data.label || 'HashMap'}
      </div>
      <div style={{ fontSize: '12px', maxHeight: '200px', overflowY: 'auto' }}>
        {Object.entries(entries).length > 0 ? (
          <div>
            {Object.entries(entries).map(([key, value]) => (
              <div
                key={key}
                style={{
                  marginBottom: '6px',
                  padding: '4px',
                  background: editingKey === key ? 'rgba(255,255,255,0.2)' : 'transparent',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {editingKey === key ? (
                  <>
                    <input
                      type="text"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      placeholder="Key"
                      style={{
                        flex: 1,
                        padding: '2px 4px',
                        borderRadius: '2px',
                        border: 'none',
                        fontSize: '11px',
                        background: 'rgba(255,255,255,0.2)',
                        color: 'white'
                      }}
                    />
                    <span>:</span>
                    <input
                      type="text"
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      placeholder="Value"
                      style={{
                        flex: 1,
                        padding: '2px 4px',
                        borderRadius: '2px',
                        border: 'none',
                        fontSize: '11px',
                        background: 'rgba(255,255,255,0.2)',
                        color: 'white'
                      }}
                    />
                    <button
                      onClick={handleSave}
                      style={{
                        padding: '2px 6px',
                        background: 'rgba(255,255,255,0.3)',
                        border: 'none',
                        borderRadius: '2px',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                    >
                      ✓
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: '600', flex: 1 }}>{key}:</span>
                    <span style={{ flex: 1 }}>{value}</span>
                    <button
                      onClick={() => handleEdit(key)}
                      style={{
                        padding: '2px 4px',
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer'
                      }}
                    >
                      <Edit2 size={10} />
                    </button>
                    <button
                      onClick={() => handleDelete(key)}
                      style={{
                        padding: '2px 4px',
                        background: 'rgba(255,0,0,0.3)',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer',
                        color: 'white',
                        fontSize: '10px'
                      }}
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>Empty</div>
        )}
        {editingKey === '__new__' && (
          <div style={{ marginTop: '6px', padding: '4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Key"
              style={{
                flex: 1,
                padding: '2px 4px',
                borderRadius: '2px',
                border: 'none',
                fontSize: '11px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white'
              }}
            />
            <span>:</span>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Value"
              style={{
                flex: 1,
                padding: '2px 4px',
                borderRadius: '2px',
                border: 'none',
                fontSize: '11px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white'
              }}
            />
            <button
              onClick={handleSave}
              style={{
                padding: '2px 6px',
                background: 'rgba(255,255,255,0.3)',
                border: 'none',
                borderRadius: '2px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              ✓
            </button>
            <button
              onClick={() => setEditingKey(null)}
              style={{
                padding: '2px 6px',
                background: 'rgba(255,0,0,0.3)',
                border: 'none',
                borderRadius: '2px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              ×
            </button>
          </div>
        )}
        {!editingKey && (
          <button
            onClick={handleAdd}
            style={{
              marginTop: '6px',
              padding: '4px 8px',
              background: 'rgba(255,255,255,0.2)',
              border: '1px dashed rgba(255,255,255,0.5)',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '11px',
              width: '100%'
            }}
          >
            + Add Entry
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// Editable Tree Node (movable and connectable)
const TreeNode = ({ data, selected }) => {
  const colors = getDataStructureColors();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.value || '');

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(data.value || '');
  };

  const handleSave = () => {
    data.onUpdate?.({ value: editValue });
    setIsEditing(false);
  };

  return (
    <div
      style={{
        background: colors.tree,
        color: 'white',
        padding: '12px',
        borderRadius: '50%',
        width: '80px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
        border: selected ? '3px solid #FFD700' : '2px solid rgba(255,255,255,0.2)',
        cursor: 'move',
        position: 'relative'
      }}
    >
      <Handle type="target" position={Position.Top} />
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            }
          }}
          autoFocus
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid white',
            borderRadius: '4px',
            color: 'white',
            width: '60px',
            textAlign: 'center',
            fontSize: '14px',
            fontWeight: 'bold',
            outline: 'none'
          }}
        />
      ) : (
        <>
          <div
            style={{ fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
            onClick={handleEdit}
            title="Double-click to edit"
          >
            {data.value || '∅'}
          </div>
          <button
            onClick={handleEdit}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0
            }}
          >
            <Edit2 size={10} />
          </button>
        </>
      )}
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
};

// Editable Heap Node
const HeapNode = ({ data, selected }) => {
  const colors = getDataStructureColors();
  const heap = data.heap || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');

  const getHeapLevel = (index) => {
    return Math.floor(Math.log2(index + 1));
  };

  const getChildren = (index) => {
    return [2 * index + 1, 2 * index + 2].filter(i => i < heap.length);
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditValue(heap[index]?.toString() || '');
  };

  const handleSave = () => {
    if (editingIndex !== null) {
      const newHeap = [...heap];
      const numValue = parseFloat(editValue);
      newHeap[editingIndex] = isNaN(numValue) ? editValue : numValue;
      data.onUpdate?.({ heap: newHeap });
      setEditingIndex(null);
    }
  };

  return (
    <div
      style={{
        background: colors.heap,
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        minWidth: '200px',
        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
        border: selected ? '3px solid #FFD700' : '2px solid rgba(255,255,255,0.2)'
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
        {data.label || 'Heap'} ({data.type || 'min'})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {heap.length > 0 ? (
          heap.map((val, idx) => (
            <div
              key={idx}
              onClick={() => handleEdit(idx)}
              style={{
                background: editingIndex === idx ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              {editingIndex === idx ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={handleSave}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSave();
                    }
                  }}
                  autoFocus
                  style={{
                    background: 'transparent',
                    border: '2px solid white',
                    borderRadius: '2px',
                    color: 'white',
                    width: '100%',
                    textAlign: 'center',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
              ) : (
                <>
                  <span style={{ fontWeight: '600' }}>[{idx}]:</span>
                  <span>{val}</span>
                </>
              )}
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.7, fontSize: '12px' }}>Empty heap</div>
        )}
        <button
          onClick={() => {
            const newHeap = [...heap, ''];
            data.onUpdate?.({ heap: newHeap });
          }}
          style={{
            marginTop: '4px',
            padding: '4px 8px',
            background: 'rgba(255,255,255,0.2)',
            border: '1px dashed rgba(255,255,255,0.5)',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '11px'
          }}
        >
          + Add Node
        </button>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// Editable Variable Node
const VariableNode = ({ data, selected }) => {
  const colors = getDataStructureColors();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.value?.toString() || '');

  const handleEdit = () => {
    setIsEditing(true);
    setEditValue(data.value?.toString() || '');
  };

  const handleSave = () => {
    const numValue = parseFloat(editValue);
    data.onUpdate?.({ value: isNaN(numValue) ? editValue : numValue });
    setIsEditing(false);
  };

  return (
    <div
      style={{
        background: colors.variable,
        color: 'white',
        padding: '10px 14px',
        borderRadius: '6px',
        minWidth: '100px',
        boxShadow: selected ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
        border: selected ? '3px solid #FFD700' : '2px solid rgba(255,255,255,0.2)',
        textAlign: 'center',
        cursor: 'pointer'
      }}
      onClick={handleEdit}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>
        {data.name || 'var'}
      </div>
      {isEditing ? (
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSave();
            }
          }}
          autoFocus
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid white',
            borderRadius: '4px',
            color: 'white',
            width: '80px',
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: 'bold',
            outline: 'none'
          }}
        />
      ) : (
        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
          {data.value !== undefined ? data.value : '?'}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// Register custom node types
const nodeTypes = {
  hashmap: HashmapNode,
  array: ArrayNode,
  heap: HeapNode,
  tree: TreeNode,
  variable: VariableNode
};

export const DryRunner = ({ aiService, onClose, itemId, domain }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [sessionContext, setSessionContext] = useState({
    shapes: [],
    variables: {},
    recentCommands: []
  });
  const [correctionMessage, setCorrectionMessage] = useState(null);
  const [historicalCorrections, setHistoricalCorrections] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const recognitionRef = useRef(null);
  const nodeIdCounter = useRef(0);
  const flowRef = useRef(null);

  // Load historical corrections on mount
  useEffect(() => {
    loadHistoricalCorrections();
  }, []);

  const loadHistoricalCorrections = async () => {
    try {
      const corrections = await getDryRunnerCorrections();
      setHistoricalCorrections(corrections);
      
      const learnedPatterns = corrections
        .filter(c => c.learned_pattern)
        .map(c => c.learned_pattern);
      
      setSessionContext((ctx) => ({
        ...ctx,
        learnedPatterns
      }));
    } catch (error) {
      console.error('[DryRunner] Failed to load corrections:', error);
    }
  };

  // Initialize Web Speech API with better error handling
  useEffect(() => {
    // Check browser support
    if (typeof window === 'undefined') return;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
      console.warn('Speech recognition not supported');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        console.log('[DryRunner] Speech recognition started');
        setSpeechError(null);
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

        setTranscript(interimTranscript || finalTranscript);

        // Process final transcript
        if (finalTranscript.trim()) {
          console.log('[DryRunner] Processing command:', finalTranscript.trim());
          processVoiceCommand(finalTranscript.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error('[DryRunner] Speech recognition error:', event.error);
        
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access.');
          setIsListening(false);
        } else if (event.error === 'no-speech') {
          // Ignore - user might be pausing
          console.log('[DryRunner] No speech detected');
          setSpeechError(null); // Clear error for no-speech
        } else if (event.error === 'aborted') {
          // User stopped or page changed
          console.log('[DryRunner] Recognition aborted');
          setIsListening(false);
        } else if (event.error === 'network') {
          // Network error - try to recover
          console.warn('[DryRunner] Network error, will retry...');
          setSpeechError('Network error. Retrying...');
          
          // Use ref to check current state, not stale closure
          const shouldRetry = () => {
            return recognitionRef.current && recognitionRef.current.state !== 'stopped';
          };
          
          // Retry after a short delay, checking current state via ref
          setTimeout(() => {
            if (!shouldRetry()) {
              console.log('[DryRunner] Retry skipped - recognition stopped');
              return;
            }
            
            try {
              // Only stop if not already stopped
              if (recognitionRef.current.state !== 'stopped') {
                recognitionRef.current.stop();
              }
              
              setTimeout(() => {
                if (!shouldRetry()) {
                  return;
                }
                
                try {
                  recognitionRef.current.start();
                  setSpeechError(null);
                  console.log('[DryRunner] Network retry successful');
                } catch (e) {
                  if (e.name === 'InvalidStateError' && e.message?.includes('already started')) {
                    // Already started, that's fine
                    setSpeechError(null);
                  } else {
                    console.error('[DryRunner] Retry start failed:', e);
                    setSpeechError('Network error. Please check your connection and try again.');
                  }
                }
              }, 500);
            } catch (e) {
              console.error('[DryRunner] Retry stop failed:', e);
              // Try to start anyway if stop failed
              if (shouldRetry()) {
                try {
                  recognitionRef.current.start();
                  setSpeechError(null);
                } catch (startError) {
                  console.error('[DryRunner] Retry start after stop error failed:', startError);
                  setSpeechError('Network error. Please check your connection and try again.');
                }
              }
            }
          }, 1000);
        } else if (event.error === 'audio-capture') {
          setSpeechError('No microphone found. Please connect a microphone.');
          setIsListening(false);
        } else if (event.error === 'service-not-allowed') {
          setSpeechError('Speech recognition service not allowed. Please check browser settings.');
          setIsListening(false);
        } else {
          setSpeechError(`Speech error: ${event.error}. Try refreshing the page.`);
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:822',message:'onend event fired',data:{isListening,hasRecognition:!!recognitionRef.current,recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
        // #endregion
        console.log('[DryRunner] Speech recognition ended');
        if (isListening) {
          // Restart if still supposed to be listening
          // Add delay to prevent rapid restart loops
          setTimeout(() => {
            // #region agent log
            fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:828',message:'onend restart timeout executed',data:{isListening,hasRecognition:!!recognitionRef.current,recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
            // #endregion
            if (isListening && recognitionRef.current) {
              try {
                recognitionRef.current.start();
                // #region agent log
                fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:831',message:'onend restart start() called',data:{recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
                // #endregion
                console.log('[DryRunner] Restarted recognition');
              } catch (e) {
                // #region agent log
                fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:835',message:'onend restart failed',data:{errorName:e.name,errorMessage:e.message,recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
                // #endregion
                // If error is "already started", that's fine
                if (e.message && e.message.includes('already started')) {
                  console.log('[DryRunner] Recognition already running');
                } else {
                  console.warn('[DryRunner] Could not restart recognition:', e);
                  // Only stop if it's a real error, not just "already started"
                  if (e.name !== 'InvalidStateError') {
                    setIsListening(false);
                    setSpeechError('Failed to restart. Please try again.');
                  }
                }
              }
            } else {
              // #region agent log
              fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:847',message:'onend restart skipped - state check failed',data:{isListening,hasRecognition:!!recognitionRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'L'})}).catch(()=>{});
              // #endregion
            }
          }, 300); // Increased delay to prevent rapid restarts
        }
      };

      recognitionRef.current = recognition;

      return () => {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
            // Ignore errors on cleanup
          }
        }
      };
    } catch (error) {
      console.error('[DryRunner] Failed to initialize speech recognition:', error);
      setSpeechError(`Failed to initialize: ${error.message}`);
    }
  }, []); // Only run once on mount

  // Handle listening state changes
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:868',message:'isListening state changed',data:{isListening,hasRecognition:!!recognitionRef.current,recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
    // #endregion
    if (!recognitionRef.current) return;

    if (isListening) {
      // Add a small delay to ensure recognition is ready
      const startTimeout = setTimeout(() => {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:875',message:'Starting recognition from useEffect',data:{isListening,recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
        // #endregion
        try {
          recognitionRef.current.start();
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:878',message:'useEffect start() called successfully',data:{recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
          // #endregion
          console.log('[DryRunner] Started listening');
          setSpeechError(null);
        } catch (error) {
          // #region agent log
          fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:882',message:'useEffect start() failed',data:{errorName:error.name,errorMessage:error.message,recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'O'})}).catch(()=>{});
          // #endregion
          console.error('[DryRunner] Failed to start:', error);
          
          // Handle specific error cases
          if (error.name === 'InvalidStateError' && error.message.includes('already started')) {
            // Already started, that's fine
            console.log('[DryRunner] Already listening');
            setSpeechError(null);
          } else if (error.message && error.message.includes('network')) {
            setSpeechError('Network error. Please check your internet connection.');
            setIsListening(false);
          } else {
            setSpeechError(`Failed to start: ${error.message || error.name}. Try refreshing the page.`);
            setIsListening(false);
          }
        }
      }, 100);

      return () => clearTimeout(startTimeout);
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:900',message:'Stopping recognition from useEffect',data:{recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P'})}).catch(()=>{});
      // #endregion
      try {
        recognitionRef.current.stop();
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:903',message:'useEffect stop() called successfully',data:{recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P'})}).catch(()=>{});
        // #endregion
        console.log('[DryRunner] Stopped listening');
        setSpeechError(null);
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7245/ingest/b54b5b6a-ac86-4e65-b689-cc2f241ea495',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'DryRunner.jsx:907',message:'useEffect stop() failed',data:{errorName:error.name,errorMessage:error.message,recognitionState:recognitionRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Q'})}).catch(()=>{});
        // #endregion
        // Ignore errors when stopping (might already be stopped)
        console.log('[DryRunner] Stop called (may already be stopped)');
      }
    }
  }, [isListening]);

  const processVoiceCommand = async (command) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setCorrectionMessage(null);

    try {
      const instructions = await understandVoiceCommand(command, sessionContext, aiService);
      
      if (instructions.correction && instructions.response) {
        setCorrectionMessage(instructions.response);
        setTimeout(() => setCorrectionMessage(null), 5000);
        
        try {
          await saveDryRunnerCorrection({
            originalCommand: command,
            correctionCommand: JSON.stringify(instructions.commands),
            context: JSON.stringify(sessionContext),
            learnedPattern: instructions.learnedPattern || null
          });
          await loadHistoricalCorrections();
        } catch (error) {
          console.error('[DryRunner] Failed to save correction:', error);
        }
      }

      const newNodes = [];
      const updatedVariables = { ...sessionContext.variables };

      instructions.commands.forEach((cmd) => {
        if (cmd.type === 'create') {
          const nodeId = cmd.id || `${cmd.shape}_${nodeIdCounter.current++}`;
          const position = { x: cmd.properties.x || Math.random() * 400 + 100, y: cmd.properties.y || Math.random() * 300 + 100 };
          
          // Create update handler
          const onUpdate = (updates) => {
            setNodes((nds) =>
              nds.map((node) =>
                node.id === nodeId
                  ? {
                      ...node,
                      data: {
                        ...node.data,
                        ...updates
                      }
                    }
                  : node
              )
            );
          };
          
          const node = {
            id: nodeId,
            type: cmd.shape,
            position,
            data: {
              label: cmd.properties.label || cmd.shape,
              ...cmd.properties.data,
              ...cmd.properties,
              onUpdate
            },
            draggable: true,
            connectable: true
          };
          
          newNodes.push(node);
        } else if (cmd.type === 'update') {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === cmd.id
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      ...cmd.properties.data,
                      ...cmd.properties
                    }
                  }
                : node
            )
          );
        } else if (cmd.type === 'delete') {
          setNodes((nds) => nds.filter((node) => node.id !== cmd.id));
          setEdges((eds) => eds.filter((edge) => edge.source !== cmd.id && edge.target !== cmd.id));
        } else if (cmd.type === 'highlight') {
          setNodes((nds) =>
            nds.map((node) =>
              node.id === cmd.id
                ? {
                    ...node,
                    style: {
                      ...node.style,
                      border: '3px solid #FFD700',
                      boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)'
                    }
                  }
                : node
            )
          );
        }
      });

      if (instructions.variables) {
        Object.assign(updatedVariables, instructions.variables);
      }

      if (newNodes.length > 0) {
        setNodes((nds) => [...nds, ...newNodes]);
      }

      setSessionContext((ctx) => ({
        shapes: [...nodes, ...newNodes],
        variables: updatedVariables,
        recentCommands: [...(ctx.recentCommands || []).slice(-10), command]
      }));

      setTranscript('');
    } catch (error) {
      console.error('[DryRunner] Error processing command:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setSpeechError('Speech recognition not available. Please use Chrome, Edge, or Safari.');
      return;
    }

    setIsListening(!isListening);
  };

  const handleScreenshot = async () => {
    try {
      const flowElement = document.querySelector('.react-flow');
      if (!flowElement) return;

      const canvas = await html2canvas(flowElement, {
        backgroundColor: '#ffffff',
        useCORS: true,
        scale: 2
      });

      const link = document.createElement('a');
      link.download = `dry-runner-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Screenshot error:', error);
      alert('Failed to take screenshot');
    }
  };

  const handleSaveNote = async () => {
    if (isSaving) return;
    setIsSaving(true);

    try {
      // Capture screenshot
      let screenshotUrl = null;
      const flowElement = document.querySelector('.react-flow');
      if (flowElement) {
        const canvas = await html2canvas(flowElement, {
          backgroundColor: '#0B0F19',
          useCORS: true,
          scale: 2
        });
        screenshotUrl = canvas.toDataURL('image/png');
      }

      // Prepare note content
      const content = {
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
          style: n.style
        })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          style: e.style,
          markerEnd: e.markerEnd
        })),
        sessionContext
      };

      // Save to database
      const saved = await saveDryRunNote({
        itemId: itemId || null,
        domain: domain || null,
        title: `Dry Runner - ${new Date().toLocaleString()}`,
        type: 'dry_runner',
        content,
        screenshotUrl
      });

      // Also download as file
      downloadNoteAsFile({
        id: saved.id,
        itemId,
        domain,
        title: `Dry Runner - ${new Date().toLocaleString()}`,
        type: 'dry_runner',
        content,
        screenshotUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      alert('Note saved successfully!');
    } catch (error) {
      console.error('[DryRunner] Save error:', error);
      alert('Failed to save note: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear all shapes?')) {
      setNodes([]);
      setEdges([]);
      setSessionContext({ shapes: [], variables: {}, recentCommands: [] });
    }
  };

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true }, eds)),
    [setEdges]
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F19] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#0B0F19]">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Dry Runner</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleListening}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4 inline mr-2" />
                  Stop Listening
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 inline mr-2" />
                  Start Listening
                </>
              )}
            </button>
            {isProcessing && (
              <div className="text-xs text-gray-400">Processing...</div>
            )}
            {speechError && (
              <div className="flex items-center gap-2">
                <div className="text-xs text-red-400 max-w-xs">{speechError}</div>
                {speechError.includes('Network') && (
                  <button
                    onClick={() => {
                      setIsListening(false);
                      setTimeout(() => {
                        setIsListening(true);
                      }, 500);
                    }}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleScreenshot}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
            title="Screenshot"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={handleClear}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
            title="Clear All"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Correction Message */}
      {correctionMessage && (
        <div className="px-4 py-2 bg-yellow-500/20 border-b border-yellow-500/30">
          <div className="text-sm text-yellow-200">{correctionMessage}</div>
        </div>
      )}

      {/* Transcript Display */}
      {transcript && (
        <div className="px-4 py-2 bg-white/5 border-b border-white/10">
          <div className="text-sm text-gray-300">
            <span className="text-gray-500">You said:</span> {transcript}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-white"
          nodesDraggable
          nodesConnectable
          elementsSelectable
        >
          <Background color="#f0f0f0" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const colors = getDataStructureColors();
              return colors[node.type] || colors.default;
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
          <Panel position="top-right" className="bg-white/90 p-2 rounded-lg shadow-lg">
            <div className="text-xs text-gray-600">
              <div className="font-semibold mb-1">Session Context:</div>
              <div>Variables: {Object.keys(sessionContext.variables).length}</div>
              <div>Shapes: {nodes.length}</div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Manual Controls */}
      <div className="px-4 py-3 border-t border-white/10 bg-[#0B0F19]">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Manual Controls:</span>
          <button
            onClick={() => {
              const newNode = {
                id: `array_${Date.now()}`,
                type: 'array',
                position: { x: Math.random() * 400, y: Math.random() * 300 },
                data: {
                  label: 'Array',
                  elements: [],
                  onUpdate: (updates) => {
                    setNodes((nds) =>
                      nds.map((node) =>
                        node.id === newNode.id
                          ? { ...node, data: { ...node.data, ...updates } }
                          : node
                      )
                    );
                  }
                },
                draggable: true,
                connectable: true
              };
              setNodes((nds) => [...nds, newNode]);
            }}
            className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300"
          >
            + Array
          </button>
          <button
            onClick={() => {
              const newNode = {
                id: `hashmap_${Date.now()}`,
                type: 'hashmap',
                position: { x: Math.random() * 400, y: Math.random() * 300 },
                data: {
                  label: 'HashMap',
                  entries: {},
                  onUpdate: (updates) => {
                    setNodes((nds) =>
                      nds.map((node) =>
                        node.id === newNode.id
                          ? { ...node, data: { ...node.data, ...updates } }
                          : node
                      )
                    );
                  }
                },
                draggable: true,
                connectable: true
              };
              setNodes((nds) => [...nds, newNode]);
            }}
            className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300"
          >
            + HashMap
          </button>
          <button
            onClick={() => {
              const newNode = {
                id: `heap_${Date.now()}`,
                type: 'heap',
                position: { x: Math.random() * 400, y: Math.random() * 300 },
                data: {
                  label: 'Heap',
                  heap: [],
                  type: 'min',
                  onUpdate: (updates) => {
                    setNodes((nds) =>
                      nds.map((node) =>
                        node.id === newNode.id
                          ? { ...node, data: { ...node.data, ...updates } }
                          : node
                      )
                    );
                  }
                },
                draggable: true,
                connectable: true
              };
              setNodes((nds) => [...nds, newNode]);
            }}
            className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300"
          >
            + Heap
          </button>
          <button
            onClick={() => {
              const newNode = {
                id: `tree_${Date.now()}`,
                type: 'tree',
                position: { x: Math.random() * 400, y: Math.random() * 300 },
                data: {
                  value: '',
                  onUpdate: (updates) => {
                    setNodes((nds) =>
                      nds.map((node) =>
                        node.id === newNode.id
                          ? { ...node, data: { ...node.data, ...updates } }
                          : node
                      )
                    );
                  }
                },
                draggable: true,
                connectable: true
              };
              setNodes((nds) => [...nds, newNode]);
            }}
            className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 text-gray-300"
          >
            + Tree Node
          </button>
        </div>
      </div>
    </div>
  );
};
