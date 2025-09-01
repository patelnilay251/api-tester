'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node
} from '@xyflow/react';
import { Plus, Zap, RotateCcw, Moon, Sun } from 'lucide-react';

import ApiRequestNode from '@/components/ApiRequestNode';
import ResponseNode from '@/components/ResponseNode';
import { useTheme } from '@/contexts/ThemeContext';

import '@xyflow/react/dist/style.css';

interface RequestData {
  url: string;
  method: string;
  headers: string;
  data: string;
}

interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  responseTime: number;
  url: string;
}

interface ApiRequestNodeData extends Record<string, unknown> {
  label: string;
  name?: string;
  onRequestSent: (nodeId: string, requestData: RequestData, response: ResponseData) => void;
  onDelete: (nodeId: string) => void;
  onNameChange?: (nodeId: string, newName: string) => void;
}

interface ResponseNodeData extends Record<string, unknown> {
  response: ResponseData;
  requestData: RequestData;
  name?: string;
  onDelete?: (nodeId: string) => void;
  onNameChange?: (nodeId: string, newName: string) => void;
}

type AppNode = Node<ApiRequestNodeData, 'apiRequest'> | Node<ResponseNodeData, 'response'>;

const nodeTypes = {
  apiRequest: ApiRequestNode,
  response: ResponseNode,
};

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [nodeId, setNodeId] = useState(0);
  const [nodeNames, setNodeNames] = useState<Record<string, string>>({});

  const handleNameChange = useCallback((nodeId: string, newName: string) => {
    setNodeNames(prev => ({
      ...prev,
      [nodeId]: newName
    }));
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    console.log('Deleting node:', nodeId);

    // Use a ref to coordinate between the two state updates
    let nodesToDelete: Set<string>;

    setEdges((currentEdges) => {
      // Find all connected nodes (children) of the node being deleted
      nodesToDelete = new Set([nodeId]);

      // Helper function to recursively find all children
      const findAllChildren = (parentId: string) => {
        currentEdges.forEach(edge => {
          if (edge.source === parentId && !nodesToDelete.has(edge.target)) {
            nodesToDelete.add(edge.target);
            // Recursively find children of this child
            findAllChildren(edge.target);
          }
        });
      };

      // Start recursive search for children
      findAllChildren(nodeId);

      console.log('Nodes to delete:', Array.from(nodesToDelete));

      // Remove all edges connected to any of the nodes being deleted
      const filteredEdges = currentEdges.filter(edge =>
        !nodesToDelete.has(edge.source) && !nodesToDelete.has(edge.target)
      );

      return filteredEdges;
    });

    setNodes((currentNodes) => {
      // Use the same nodesToDelete set from the edges update
      const filteredNodes = currentNodes.filter(node => !nodesToDelete.has(node.id));
      console.log('Remaining nodes after deletion:', filteredNodes.length);

      return filteredNodes;
    });

    // Clean up node names
    setNodeNames(prev => {
      const newNames = { ...prev };
      nodesToDelete.forEach(id => {
        delete newNames[id];
      });
      return newNames;
    });
  }, [setNodes, setEdges]);

  const handleDeleteSingleNode = useCallback((nodeId: string) => {
    console.log('Deleting single node:', nodeId);

    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));

    // Clean up node name
    setNodeNames(prev => {
      const newNames = { ...prev };
      delete newNames[nodeId];
      return newNames;
    });
  }, [setNodes, setEdges]);

  const handleRequestSent = useCallback((nodeId: string, requestData: RequestData, response: ResponseData) => {
    console.log('handleRequestSent called:', { nodeId, requestData, response });

    const responseNodeId = `response-${Date.now()}`;

    setNodes((currentNodes) => {
      const sourceNode = currentNodes.find(node => node.id === nodeId);
      if (!sourceNode) {
        console.log('Source node not found:', nodeId);
        return currentNodes;
      }

      // Create response node
      const responseNode: AppNode = {
        id: responseNodeId,
        type: 'response',
        position: {
          x: sourceNode.position.x + 400,
          y: sourceNode.position.y,
        },
        data: {
          response,
          requestData,
          name: nodeNames[responseNodeId] || `Response ${response.status}`,
          onDelete: handleDeleteSingleNode,
          onNameChange: handleNameChange,
        },
      };

      console.log('Creating response node:', responseNode);
      return [...currentNodes, responseNode];
    });

    setEdges((currentEdges) => {
      const newEdge = {
        id: `edge-${nodeId}-${responseNodeId}`,
        source: nodeId,
        target: responseNodeId,
        type: 'default',
        style: {
          stroke: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
          strokeWidth: 2
        },
        animated: true,
      };

      console.log('Creating edge:', newEdge);
      return [...currentEdges, newEdge];
    });
  }, [setNodes, setEdges, handleDeleteSingleNode, handleNameChange, nodeNames]);

  const initialNodes: AppNode[] = useMemo(() => [
    {
      id: 'api-1',
      type: 'apiRequest',
      position: { x: 100, y: 100 },
      data: {
        label: 'API Request',
        name: nodeNames['api-1'] || 'API Request',
        onRequestSent: handleRequestSent,
        onDelete: handleDeleteNode,
        onNameChange: handleNameChange,
      },
    },
  ], [handleRequestSent, handleDeleteNode, handleNameChange, nodeNames]);

  // Initialize with first node
  useEffect(() => {
    if (nodes.length === 0) {
      setNodes(initialNodes);
      setNodeId(1);
    }
  }, [nodes.length, initialNodes, setNodes]);

  // Update existing nodes with fresh callback references
  useEffect(() => {
    setNodes((currentNodes) => {
      const needsUpdate = currentNodes.some(node =>
        (node.type === 'apiRequest' &&
          (node.data.onRequestSent !== handleRequestSent ||
            node.data.onDelete !== handleDeleteNode ||
            node.data.onNameChange !== handleNameChange ||
            node.data.name !== nodeNames[node.id])) ||
        (node.type === 'response' &&
          (node.data.onDelete !== handleDeleteSingleNode ||
            node.data.onNameChange !== handleNameChange ||
            node.data.name !== nodeNames[node.id]))
      );

      if (!needsUpdate) return currentNodes;

      return currentNodes.map((node) => {
        if (node.type === 'apiRequest') {
          return {
            ...node,
            data: {
              ...node.data,
              name: nodeNames[node.id] || node.data.name || 'API Request',
              onRequestSent: handleRequestSent,
              onDelete: handleDeleteNode,
              onNameChange: handleNameChange,
            },
          };
        } else if (node.type === 'response') {
          return {
            ...node,
            data: {
              ...node.data,
              name: nodeNames[node.id] || node.data.name || `Response ${node.data.response?.status || ''}`,
              onDelete: handleDeleteSingleNode,
              onNameChange: handleNameChange,
            },
          };
        }
        return node;
      });
    });
  }, [handleRequestSent, handleDeleteNode, handleDeleteSingleNode, handleNameChange, nodeNames, setNodes]);

  // Update edge colors when theme changes
  useEffect(() => {
    setEdges((currentEdges) => {
      return currentEdges.map((edge) => ({
        ...edge,
        style: {
          ...edge.style,
          stroke: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
        }
      }));
    });
  }, [theme, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge = {
        ...params,
        style: {
          stroke: theme === 'dark' ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)',
          strokeWidth: 2
        },
        animated: true,
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, theme]
  );

  const handleAddNewApiNode = useCallback(() => {
    const newId = `api-${nodeId + 1}`;
    const newNode: AppNode = {
      id: newId,
      type: 'apiRequest',
      position: {
        x: Math.random() * 500 + 100,
        y: Math.random() * 300 + 100,
      },
      data: {
        label: 'API Request',
        name: nodeNames[newId] || 'API Request',
        onRequestSent: handleRequestSent,
        onDelete: handleDeleteNode,
        onNameChange: handleNameChange,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setNodeId(nodeId + 1);
  }, [nodeId, handleRequestSent, handleDeleteNode, handleNameChange, nodeNames, setNodes]);

  const handleReset = useCallback(() => {
    setNodes(initialNodes);
    setEdges([]);
    setNodeId(1);
    setNodeNames({});
  }, [initialNodes, setNodes, setEdges]);

  return (
    <div className="h-screen w-screen canvas-background">
      {/* Control Panel */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-6 right-6 z-50 glass-themed rounded-2xl"
        style={{
          background: 'var(--node-bg)',
          borderColor: 'var(--node-border)',
          boxShadow: 'var(--node-shadow)'
        }}
      >
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--node-text)' }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleAddNewApiNode}
            className="flex items-center gap-2 px-4 py-2 rounded-xl button-glass"
            style={{
              backgroundColor: 'var(--button-primary-bg)',
              color: 'var(--button-primary-text)'
            }}
          >
            <Plus className="w-4 h-4" />
            Add API Node
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-xl button-glass"
            style={{
              backgroundColor: 'var(--button-secondary-bg)',
              color: 'var(--button-secondary-text)',
              border: '1px solid var(--node-border)'
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </motion.div>

      {/* React Flow Canvas */}
      <div className="h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.2,
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          proOptions={{ hideAttribution: true }}
        >
        </ReactFlow>
      </div>
    </div>
  );
}