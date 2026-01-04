/**
 * Notebook-style Node Components
 * These nodes are rendered as hand-drawn sketches
 */

import React from 'react';
import { Handle, Position } from 'reactflow';

/**
 * Array Node - Rendered as hand-drawn boxes
 */
export const NotebookArrayNode = ({ data, selected }) => {
  const elements = data.elements || [];
  const label = data.label || 'Array';
  const showIndices = data.showIndices !== false;

  return (
    <div
      style={{
        position: 'relative',
        minWidth: elements.length * 50 + 20,
        minHeight: 60,
        opacity: selected ? 0.1 : 0.05 // Very faint for semantic layer
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Label */}
      <div
        style={{
          position: 'absolute',
          left: -30,
          top: 20,
          fontSize: 12,
          color: '#666',
          opacity: 0.3
        }}
      >
        {label}
      </div>

      {/* Array cells - semantic structure only */}
      <div style={{ display: 'flex', gap: 2, marginTop: 20 }}>
        {elements.map((element, index) => (
          <div
            key={index}
            style={{
              width: 48,
              height: 40,
              border: '1px dashed #ccc',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}
          >
            {showIndices && (
              <div
                style={{
                  position: 'absolute',
                  top: -15,
                  fontSize: 10,
                  color: '#999',
                  opacity: 0.3
                }}
              >
                {index}
              </div>
            )}
            <div
              style={{
                fontSize: 14,
                color: '#333',
                opacity: 0.3
              }}
            >
              {element !== null && element !== undefined ? element : ''}
            </div>
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

/**
 * Recursion Frame Node - Open-top box
 */
export const NotebookRecursionFrameNode = ({ data, selected }) => {
  const { functionName, parameters = {}, level = 0 } = data;
  const paramString = Object.entries(parameters)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');

  return (
    <div
      style={{
        position: 'relative',
        minWidth: 200,
        minHeight: 80,
        opacity: selected ? 0.1 : 0.05,
        marginLeft: level * 20 // Stacking offset
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Function signature */}
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: 5,
          fontSize: 10,
          color: '#4A90E2',
          opacity: 0.3
        }}
      >
        {functionName}({paramString})
      </div>

      {/* Content area - semantic structure */}
      <div
        style={{
          marginTop: 20,
          minHeight: 60,
          border: '1px dashed #4A90E2',
          borderTop: 'none', // Open top
          opacity: 0.3,
          padding: 10
        }}
      >
        {data.content || ''}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

/**
 * Tree Node - Hand-drawn circle
 */
export const NotebookTreeNode = ({ data, selected }) => {
  const { value, children = [] } = data;

  return (
    <div
      style={{
        position: 'relative',
        opacity: selected ? 0.1 : 0.05
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Node circle - semantic structure */}
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: '50%',
          border: '2px dashed #ccc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.3
        }}
      >
        <span style={{ fontSize: 14, color: '#333', opacity: 0.3 }}>
          {value}
        </span>
      </div>

      {children.map((child, index) => (
        <Handle
          key={index}
          type="source"
          position={index === 0 ? Position.Left : Position.Right}
          id={`child-${index}`}
        />
      ))}
    </div>
  );
};

/**
 * Hashmap Node - Irregular container
 */
export const NotebookHashmapNode = ({ data, selected }) => {
  const { entries = {} } = data;

  return (
    <div
      style={{
        position: 'relative',
        minWidth: 150,
        minHeight: 100,
        opacity: selected ? 0.1 : 0.05
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Hashmap container - semantic structure */}
      <div
        style={{
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: 10,
          opacity: 0.3
        }}
      >
        {Object.entries(entries).map(([key, value], index) => (
          <div
            key={index}
            style={{
              fontSize: 12,
              color: '#333',
              opacity: 0.3,
              marginBottom: 5
            }}
          >
            {key}: {value}
          </div>
        ))}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

/**
 * Pointer/Iterator Node - Arrow indicator
 */
export const NotebookPointerNode = ({ data, selected }) => {
  const { label, target } = data;

  return (
    <div
      style={{
        position: 'relative',
        opacity: selected ? 0.1 : 0.05
      }}
    >
      <Handle type="target" position={Position.Top} />
      
      {/* Pointer indicator - semantic structure */}
      <div
        style={{
          fontSize: 12,
          color: '#FF6B6B',
          opacity: 0.3,
          fontWeight: 'bold'
        }}
      >
        → {label}
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

// Node type mapping
export const notebookNodeTypes = {
  notebookArray: NotebookArrayNode,
  notebookRecursionFrame: NotebookRecursionFrameNode,
  notebookTree: NotebookTreeNode,
  notebookHashmap: NotebookHashmapNode,
  notebookPointer: NotebookPointerNode
};

