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

const nodeTypes = {
  apiRequest: ApiRequestNode,
  response: ResponseNode,
};

export default function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [nodeId, setNodeId] = useState(0);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
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
      const responseNode = {
        id: responseNodeId,
        type: 'response',
        position: {
          x: sourceNode.position.x + 400,
          y: sourceNode.position.y,
        },
        data: {
          response,
          requestData,
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
  }, [setNodes, setEdges]);

  const initialNodes = useMemo(() => [
    {
      id: 'api-1',
      type: 'apiRequest',
      position: { x: 100, y: 100 },
      data: {
        label: 'API Request',
        onRequestSent: handleRequestSent,
        onDelete: handleDeleteNode,
      },
    },
  ], [handleRequestSent, handleDeleteNode]);

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
        node.type === 'apiRequest' &&
        (node.data.onRequestSent !== handleRequestSent || node.data.onDelete !== handleDeleteNode)
      );

      if (!needsUpdate) return currentNodes;

      return currentNodes.map((node) => {
        if (node.type === 'apiRequest') {
          return {
            ...node,
            data: {
              ...node.data,
              onRequestSent: handleRequestSent,
              onDelete: handleDeleteNode,
            },
          };
        }
        return node;
      });
    });
  }, [handleRequestSent, handleDeleteNode, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleAddNewApiNode = useCallback(() => {
    const newId = `api-${nodeId + 1}`;
    const newNode = {
      id: newId,
      type: 'apiRequest',
      position: {
        x: Math.random() * 500 + 100,
        y: Math.random() * 300 + 100,
      },
      data: {
        label: 'API Request',
        onRequestSent: handleRequestSent,
        onDelete: handleDeleteNode,
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setNodeId(nodeId + 1);
  }, [nodeId, handleRequestSent, handleDeleteNode, setNodes]);

  const handleReset = useCallback(() => {
    setNodes(initialNodes);
    setEdges([]);
    setNodeId(1);
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