'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  Panel
} from '@xyflow/react';
import { Plus, Zap, RotateCcw } from 'lucide-react';

import ApiRequestNode from '@/components/ApiRequestNode';
import ResponseNode from '@/components/ResponseNode';

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
        style: { stroke: '#000', strokeWidth: 2 },
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

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
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
    <div className="h-screen w-screen bg-gradient-to-br from-white to-gray-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/10"
      >
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-playfair font-light text-black">
              API Flow Tester
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNewApiNode}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-xl hover:bg-black/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add API Node
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-black rounded-xl hover:bg-gray-200 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>
      </motion.div>

      {/* React Flow Canvas */}
      <div className="h-full pt-16">
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
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#000000"
            style={{ opacity: 0.1 }}
          />
          <Controls
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: '12px',
            }}
          />

          {/* Custom Panel for Instructions */}
          <Panel position="bottom-left" className="bg-white/90 backdrop-blur-xl rounded-xl p-4 border border-black/10 max-w-xs">
            <div className="text-xs text-black/60 space-y-1">
              <p className="font-medium">💡 Tips:</p>
              <p>• Drag nodes to reposition</p>
              <p>• Zoom and pan the canvas</p>
              <p>• Send requests to create response branches</p>
              <p>• Delete nodes with the ❌ button</p>
            </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}