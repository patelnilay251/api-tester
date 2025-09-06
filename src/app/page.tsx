'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ReactFlow, useNodesState, useEdgesState, addEdge, Connection, Edge, Node } from '@xyflow/react';
import { Plus, RotateCcw, Moon, Sun, Menu, X, Settings, Info, Github, Coffee, Clock } from 'lucide-react';

import ApiRequestNode from '@/components/ApiRequestNode';
import ResponseNode from '@/components/ResponseNode';
import { useTheme } from '@/contexts/ThemeContext';
import { useEnv } from '@/contexts/EnvContext';
import { useHistoryLog } from '@/contexts/HistoryContext';
import { RequestData, ResponseData, Assertion, AssertionResult } from '@/types';
import useAppStore from '@/store/appStore';

import '@xyflow/react/dist/style.css';
import AgentChatBar from '@/components/chat/AgentChatBar';
import { setAgentContextProvider, setAgentActionApplier } from '@/lib/agentBridge';
import type { CanvasContextPayload, CanvasAction } from '@/types/agent';
import ContextPanel from '@/components/chat/ContextPanel';

interface ApiRequestNodeData extends Record<string, unknown> {
  label: string;
  name?: string;
  initialRequest?: RequestData;
  onRequestSent: (
    nodeId: string,
    requestData: RequestData,
    response: ResponseData,
    meta?: { assertions?: Assertion[]; results?: AssertionResult[] }
  ) => void;
  onDelete: (nodeId: string) => void;
  onNameChange?: (nodeId: string, newName: string) => void;
}

interface ResponseNodeData extends Record<string, unknown> {
  response: ResponseData;
  requestData: RequestData;
  assertions?: Assertion[];
  assertionResults?: AssertionResult[];
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
  const env = useEnv();
  const historyLog = useHistoryLog();
  const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [nodeId, setNodeId] = useState(0);
  const [nodeNames, setNodeNames] = useState<Record<string, string>>({});
  const isMenuOpen = useAppStore((s) => s.isMenuOpen);
  const setIsMenuOpen = useAppStore((s) => s.setIsMenuOpen);
  const isChatOpen = useAppStore((s) => s.isChatOpen);
  const openChat = useAppStore((s) => s.openChat);
  const closeChat = useAppStore((s) => s.closeChat);
  // Chat/Context model and message handling moved into components
  const isContextOpen = useAppStore((s) => s.isContextOpen);
  const openContext = useAppStore((s) => s.openContext);
  const closeContext = useAppStore((s) => s.closeContext);
  // Streaming state and refs moved into components
  // compact: remove unused interaction marker to satisfy lint
  const isEnvOpen = useAppStore((s) => s.isEnvOpen);
  const setIsEnvOpen = useAppStore((s) => s.setIsEnvOpen);
  const isHistoryOpen = useAppStore((s) => s.isHistoryOpen);
  const setIsHistoryOpen = useAppStore((s) => s.setIsHistoryOpen);
  const activeFlowId = useAppStore((s) => s.activeFlowId);
  const setActiveFlowId = useAppStore((s) => s.setActiveFlowId);


  // Track last-known request/response per node to provide LLM context and enable send actions
  const [nodeMeta, setNodeMeta] = useState<Record<string, {
    lastRequest?: RequestData;
    lastResponse?: ResponseData;
    assertions?: Assertion[];
    name?: string;
  }>>({});


  const handleNameChange = useCallback((nodeId: string, newName: string) => {
    try { fetch('/api/client-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'rename_node', flowId: activeFlowId, payload: { nodeId, newName } }) }); } catch {}
    setNodeNames(prev => ({
      ...prev,
      [nodeId]: newName
    }));
    setNodeMeta(prev => ({ ...prev, [nodeId]: { ...(prev[nodeId] || {}), name: newName } }));
  }, [activeFlowId]);

  const handleDeleteNode = useCallback((nodeId: string) => {
    console.log('Deleting node:', nodeId);
    try { fetch('/api/client-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'delete_node_cascade', flowId: activeFlowId, payload: { nodeId } }) }); } catch {}

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
  }, [setNodes, setEdges, activeFlowId]);

  const handleDeleteSingleNode = useCallback((nodeId: string) => {
    console.log('Deleting single node:', nodeId);
    try { fetch('/api/client-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'delete_node', flowId: activeFlowId, payload: { nodeId } }) }); } catch {}

    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));

    // Clean up node name
    setNodeNames(prev => {
      const newNames = { ...prev };
      delete newNames[nodeId];
      return newNames;
    });
  }, [setNodes, setEdges, activeFlowId]);

  const handleRequestSent = useCallback((
    nodeId: string,
    requestData: RequestData,
    response: ResponseData,
    meta?: { assertions?: Assertion[]; results?: AssertionResult[] }
  ) => {
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
          assertions: meta?.assertions || [],
          assertionResults: meta?.results || [],
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
    // track last request/response for context
    setNodeMeta((prev) => ({
      ...prev,
      [nodeId]: { ...(prev[nodeId] || {}), lastRequest: requestData, lastResponse: response, assertions: meta?.assertions || (prev[nodeId]?.assertions || []), name: nodeNames[nodeId] },
    }));
  }, [setNodes, setEdges, handleDeleteSingleNode, handleNameChange, nodeNames, theme]);

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

  // Autosave flow (nodes/edges, node names) with debounce
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const body = { id: activeFlowId, name: 'Default Flow', content: { nodes, edges, nodeNames } };
        fetch('/api/flow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }).then(async (res) => {
          try { const j = await res.json(); if (j?.id && !activeFlowId) setActiveFlowId(j.id); } catch {}
        });
      } catch {}
    }, 600);
    return () => clearTimeout(t);
  }, [nodes, edges, nodeNames, activeFlowId, setActiveFlowId]);

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
      try { fetch('/api/client-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'connect', flowId: activeFlowId, payload: params }) }); } catch {}
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
    [setEdges, theme, activeFlowId]
  );

  const handleAddNewApiNode = useCallback(() => {
    try { fetch('/api/client-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'add_node', flowId: activeFlowId }) }); } catch {}
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
    setNodeMeta((prev) => ({ ...prev, [newId]: { name: nodeNames[newId] || 'API Request' } }));
  }, [nodeId, handleRequestSent, handleDeleteNode, handleNameChange, nodeNames, setNodes, activeFlowId]);

  const handleAddNodeFromRequestData = useCallback((initialRequest: RequestData) => {
    try { fetch('/api/client-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'add_node_from_history', flowId: activeFlowId, payload: { url: initialRequest.url, method: initialRequest.method } }) }); } catch {}
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
        initialRequest,
        onRequestSent: handleRequestSent,
        onDelete: handleDeleteNode,
        onNameChange: handleNameChange,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setNodeId(nodeId + 1);
    setNodeMeta((prev) => ({ ...prev, [newId]: { lastRequest: initialRequest, assertions: initialRequest.assertions || [], name: nodeNames[newId] || 'API Request' } }));
  }, [nodeId, nodeNames, handleRequestSent, handleDeleteNode, handleNameChange, setNodes, activeFlowId]);

  const handleReset = useCallback(() => {
    try { fetch('/api/client-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'reset_graph', flowId: activeFlowId }) }); } catch {}
    setNodes(initialNodes);
    setEdges([]);
    setNodeId(1);
    setNodeNames({});
    setNodeMeta({});
  }, [initialNodes, setNodes, setEdges, activeFlowId]);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen, setIsMenuOpen]);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, [setIsMenuOpen]);

  // removed unused toggleChat

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'i') {
        event.preventDefault();
        if (isChatOpen) { closeChat(); } else { openChat(); }
      }
      // Prefer Cmd/Ctrl+Shift+K to avoid browser conflicts.
      if ((event.metaKey || event.ctrlKey) && (event.key === 'K' || event.key === 'k') && event.shiftKey) {
        event.preventDefault();
        if (isContextOpen) closeContext(); else openContext();
      }
      // Best-effort support for Cmd/Ctrl+K (some browsers route to search)
      if ((event.metaKey || event.ctrlKey) && (event.key === 'K' || event.key === 'k') && !event.shiftKey) {
        try { event.preventDefault(); } catch { }
        if (isContextOpen) closeContext(); else openContext();
      }
      if (event.key === 'Escape' && isChatOpen) {
        event.preventDefault();
        closeChat();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [openChat, closeChat, isChatOpen, isContextOpen, openContext, closeContext]);

  // Provide serialized canvas context to the agent
  const serializeSelectionForLLM = useCallback((): CanvasContextPayload => {
    const selected = nodes.filter((n) => n.selected);
    const selectedIds = new Set(selected.map((n) => n.id));
    const selectedNodes = selected.map((n) => {
      const meta = nodeMeta[n.id] || {};
      const req = meta.lastRequest;
      const res = meta.lastResponse;
      const headersPreview: Record<string, string> = {};
      try {
        if (req?.headers) {
          const raw = req.headers;
          let parsed: Record<string, string> = {};
          if (typeof raw === 'string') parsed = JSON.parse(raw);
          else parsed = raw as Record<string, string>;
          Object.keys(parsed).slice(0, 6).forEach((k) => { headersPreview[k] = String(parsed[k]); });
        }
      } catch {}
      return {
        id: n.id,
        type: n.type || 'apiRequest',
        name: nodeNames[n.id] || meta.name,
        lastRequest: req ? {
          url: req.url,
          method: req.method,
          headersPreview,
          bodyPreview: req.data ? (typeof req.data === 'string' ? req.data.slice(0, 256) : JSON.stringify(req.data).slice(0, 256)) : undefined,
        } : undefined,
        lastResponse: res ? {
          status: res.status,
          responseTime: res.responseTime,
          fromCache: !!res.fromCache,
        } : undefined,
      };
    });
    const simpleEdges = edges
      .filter((e) => selectedIds.has(e.source) || selectedIds.has(e.target))
      .map((e) => ({ id: e.id, source: e.source, target: e.target }));
    return { selectedNodes, edges: simpleEdges };
  }, [nodes, edges, nodeMeta, nodeNames]);

  useEffect(() => {
    setAgentContextProvider(() => serializeSelectionForLLM());
  }, [serializeSelectionForLLM]);

  // Helpers: update a node's initialRequest data
  const patchRequestOnNode = useCallback((id: string, patch: Partial<RequestData>) => {
    setNodes((current) => current.map((n) => {
      if (n.id !== id || n.type !== 'apiRequest') return n;
      const apiNode = n as Node<ApiRequestNodeData, 'apiRequest'>;
      const prevInit = apiNode.data.initialRequest as RequestData | undefined;
      const merged: RequestData = {
        url: prevInit?.url || '',
        method: prevInit?.method || 'GET',
        headers: prevInit?.headers || '',
        data: prevInit?.data || '',
        queryParams: prevInit?.queryParams || [],
        useBearer: prevInit?.useBearer || false,
        bearerToken: prevInit?.bearerToken || '',
        assertions: prevInit?.assertions || [],
        ...patch,
      };
      return { ...apiNode, data: { ...apiNode.data, initialRequest: merged } } as AppNode;
    }));
    setNodeMeta((prev) => {
      const prevMeta = prev[id] || {};
      const base: RequestData = prevMeta.lastRequest ?? {
        url: '',
        method: 'GET',
        headers: '',
        data: '',
        queryParams: [],
        useBearer: false,
        bearerToken: '',
        assertions: [],
      };
      const newLastRequest: RequestData = { ...base, ...patch };
      return { ...prev, [id]: { ...prevMeta, lastRequest: newLastRequest } };
    });
  }, [setNodes, setNodeMeta]);

  // Send request for a node id using last known data
  const sendRequestForNode = useCallback(async (id: string) => {
    const node = nodes.find((n) => n.id === id && n.type === 'apiRequest');
    if (!node) return;
    const apiNode = node as Node<ApiRequestNodeData, 'apiRequest'>;
    const initReq = apiNode.data.initialRequest as RequestData | undefined;
    const reqData = nodeMeta[id]?.lastRequest || initReq;
    if (!reqData || !reqData.url || !reqData.method) return;

    // replicate client request building (headers/data, env, bearer)
    try {
      // parse headers
      let parsedHeaders: Record<string, string> = {};
      if (reqData.headers?.trim()) {
        try { parsedHeaders = JSON.parse(reqData.headers) as Record<string, string>; } catch {
          const headerLines = reqData.headers.split('\n');
          parsedHeaders = headerLines.reduce<Record<string, string>>((acc, line) => {
            const [key, value] = line.split(':').map((s) => s.trim());
            if (key && value) acc[key] = value;
            return acc;
          }, {});
        }
      }
      // parse body
      let parsedData: unknown = null;
      if (reqData.data?.trim()) {
        try { parsedData = JSON.parse(reqData.data); } catch { parsedData = reqData.data; }
      }

      // build URL with env and query params
      let resolvedUrl = env.resolveString(reqData.url);
      if (resolvedUrl.startsWith('/')) {
        const base = env.baseUrl ? env.baseUrl.replace(/\/$/, '') : '';
        resolvedUrl = `${base}${resolvedUrl}`;
      }
      try {
        const u = new URL(resolvedUrl);
        (reqData.queryParams || []).forEach(({ key, value }) => {
          if (key) u.searchParams.set(env.resolveString(key), env.resolveString(value));
        });
        resolvedUrl = u.toString();
      } catch {}

      const useBearer = !!reqData.useBearer;
      const bearerToken = (reqData.bearerToken?.trim() || env.token || '');
      if (useBearer && bearerToken && !parsedHeaders['Authorization']) {
        parsedHeaders['Authorization'] = `Bearer ${env.resolveString(bearerToken)}`;
      }

      parsedHeaders = env.resolveDeep(parsedHeaders);
      parsedData = env.resolveDeep(parsedData);

      const res = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: resolvedUrl, method: reqData.method, headers: parsedHeaders, data: parsedData }),
      });
      const result: ResponseData = await res.json();
      if (res.ok) {
        handleRequestSent(id, reqData as RequestData, result, { assertions: reqData.assertions || [], results: [] });
      }
    } catch (e) {
      console.error('sendRequestForNode error', e);
    }
  }, [nodes, nodeMeta, env, handleRequestSent]);

  // Agent action applier
  const applyCanvasAction = useCallback(async (action: CanvasAction) => {
    try { fetch('/api/client-actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: action.type, flowId: activeFlowId, payload: action }) }); } catch {}
    switch (action.type) {
      case 'create_request_node': {
        const newId = `api-${Date.now()}`;
        const pos = action.position || {};
        const initialRequest: RequestData | undefined = action.request ? {
          url: action.request.url || '',
          method: (action.request.method as string) || 'GET',
          headers: typeof action.request.headers === 'string' ? action.request.headers : JSON.stringify(action.request.headers || {}, null, 2),
          data: typeof action.request.body === 'string' ? action.request.body : (action.request.body ? JSON.stringify(action.request.body, null, 2) : ''),
          queryParams: action.request.queryParams || [],
          useBearer: false,
          bearerToken: '',
          assertions: [],
        } : undefined;
        const newNode: AppNode = {
          id: newId,
          type: 'apiRequest',
          position: { x: pos.x ?? (100 + Math.random() * 400), y: pos.y ?? (100 + Math.random() * 200) },
          data: {
            label: 'API Request',
            name: action.name || 'API Request',
            initialRequest,
            onRequestSent: handleRequestSent,
            onDelete: handleDeleteNode,
            onNameChange: handleNameChange,
          },
        };
        setNodes((nds) => [...nds, newNode]);
        setNodeMeta((prev) => ({ ...prev, [newId]: { lastRequest: initialRequest, assertions: initialRequest?.assertions || [], name: action.name || 'API Request' } }));
        break;
      }
      case 'update_request': {
        patchRequestOnNode(action.nodeId, {
          url: action.patch.url,
          method: (action.patch.method as string) || undefined,
          headers: typeof action.patch.headers === 'string' ? action.patch.headers : (action.patch.headers ? JSON.stringify(action.patch.headers, null, 2) : undefined),
          data: typeof action.patch.body === 'string' ? action.patch.body : (action.patch.body != null ? JSON.stringify(action.patch.body, null, 2) : undefined),
          queryParams: action.patch.queryParams,
          useBearer: action.patch.useBearer,
          bearerToken: action.patch.bearerToken,
        });
        break;
      }
      case 'send_request': {
        await sendRequestForNode(action.nodeId);
        break;
      }
      case 'connect_nodes': {
        setEdges((eds) => addEdge({ id: `edge-${action.sourceId}-${action.targetId}-${Date.now()}`, source: action.sourceId, target: action.targetId, animated: true, style: { stroke: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)', strokeWidth: 2 } }, eds));
        break;
      }
      case 'rename_node': {
        handleNameChange(action.nodeId, action.name);
        break;
      }
      case 'delete_node': {
        handleDeleteSingleNode(action.nodeId);
        break;
      }
      case 'add_assertion': {
        const prev = nodeMeta[action.nodeId]?.lastRequest;
        if (prev) {
          const assertions = [...(prev.assertions || [])];
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const toAdd: Assertion = { id, ...action.assertion } as Assertion;
          assertions.push(toAdd);
          patchRequestOnNode(action.nodeId, { assertions });
        }
        break;
      }
      case 'remove_assertion': {
        const prev = nodeMeta[action.nodeId]?.lastRequest;
        if (prev && prev.assertions) {
          let assertions = prev.assertions.slice();
          if (action.assertionId) assertions = assertions.filter((a: Assertion) => a.id !== action.assertionId);
          else if (action.match) assertions = assertions.filter((a: Assertion) => a.type !== action.match?.type);
          patchRequestOnNode(action.nodeId, { assertions });
        }
        break;
      }
      default:
        break;
    }
  }, [activeFlowId, theme, setEdges, setNodes, handleRequestSent, handleDeleteNode, handleNameChange, handleDeleteSingleNode, nodeMeta, patchRequestOnNode, sendRequestForNode]);

  useEffect(() => {
    setAgentActionApplier(applyCanvasAction);
  }, [applyCanvasAction]);

  return (
    <div className="h-screen w-screen canvas-background">
      {/* Hamburger Menu */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute top-6 left-6 z-50"
      >
        {/* Hamburger Button */}
        <motion.button
          onClick={toggleMenu}
          className="flex items-center justify-center w-12 h-12 glass-themed rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
          style={{
            background: 'var(--node-bg)',
            borderColor: 'var(--node-border)',
            boxShadow: 'var(--node-shadow)',
            color: 'var(--node-text)'
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            animate={isMenuOpen ? { rotate: 180 } : { rotate: 0 }}
            transition={{ duration: 0.2 }}
          >
            {isMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </motion.div>
        </motion.button>

        {/* Menu Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={isMenuOpen ?
            { opacity: 1, scale: 1, y: 0 } :
            { opacity: 0, scale: 0.95, y: -10 }
          }
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={`absolute top-16 left-0 w-64 glass-themed rounded-2xl overflow-hidden ${isMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          style={{
            background: 'var(--node-bg)',
            borderColor: 'var(--node-border)',
            boxShadow: 'var(--node-shadow)'
          }}
        >
          <div className="p-4">
            {/* Menu Header */}
            <div className="mb-4">
              <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--node-text)' }}>
                API Flow Tester
              </h3>
              <p className="text-xs" style={{ color: 'var(--node-text-muted)' }}>
                Visual API testing tool
              </p>
            </div>

            {/* Menu Items */}
            <div className="space-y-1">
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--node-text)' }}
                onClick={() => setIsEnvOpen(!isEnvOpen)}
              >
                <Settings className="w-4 h-4" style={{ color: 'var(--node-text-muted)' }} />
                Environment
              </motion.button>

              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--node-text)' }}
                onClick={closeMenu}
              >
                <Info className="w-4 h-4" style={{ color: 'var(--node-text-muted)' }} />
                About
              </motion.button>

              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--node-text)' }}
                onClick={() => {
                  window.open('https://github.com', '_blank');
                  closeMenu();
                }}
              >
                <Github className="w-4 h-4" style={{ color: 'var(--node-text-muted)' }} />
                GitHub
              </motion.button>

              <div className="border-t my-2" style={{ borderColor: 'var(--node-border)' }}></div>

              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--node-text)' }}
                onClick={closeMenu}
              >
                <Coffee className="w-4 h-4" style={{ color: 'var(--node-text-muted)' }} />
                Support Us
              </motion.button>
            </div>

            {/* Environment Editor */}
            {isEnvOpen && (
              <div className="mt-2 p-3 rounded-xl" style={{ background: 'var(--node-header-bg)', border: '1px solid var(--node-border)' }}>
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--node-text-muted)' }}>{'Base URL ({{baseUrl}})'}</label>
                    <input
                      type="text"
                      value={env.baseUrl}
                      onChange={(e) => env.setBaseUrl(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                      style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                      placeholder="https://api.example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--node-text-muted)' }}>{'Token ({{token}})'}</label>
                    <input
                      type="text"
                      value={env.token}
                      onChange={(e) => env.setToken(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                      style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                      placeholder="your-token"
                    />
                  </div>
                  {/* Custom Vars - minimal (list + add) */}
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--node-text-muted)' }}>Custom Variables</label>
                    <div className="space-y-1">
                      {Object.entries(env.vars).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={k}
                            onChange={(e) => {
                              const newKey = e.target.value;
                              if (!newKey) return;
                              const val = env.vars[k];
                              env.removeVar(k);
                              env.setVar(newKey, val);
                            }}
                            className="w-1/3 px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                            style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                          />
                          <input
                            type="text"
                            value={v}
                            onChange={(e) => env.setVar(k, e.target.value)}
                            className="flex-1 px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                            style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                          />
                          <button onClick={() => env.removeVar(k)} className="px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" title="Remove">
                            <X className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => env.setVar(`var${Object.keys(env.vars).length + 1}`, '')}
                        className="px-2 py-1.5 text-xs rounded-lg button-glass"
                        style={{ backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' }}
                      >
                        + Add Variable
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Theme Toggle in Menu */}
            <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--node-border)' }}>
              <motion.button
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  toggleTheme();
                  closeMenu();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
                style={{ color: 'var(--node-text)' }}
              >
                <div className="flex items-center gap-3">
                  {theme === 'dark' ? (
                    <Sun className="w-4 h-4" style={{ color: 'var(--node-text-muted)' }} />
                  ) : (
                    <Moon className="w-4 h-4" style={{ color: 'var(--node-text-muted)' }} />
                  )}
                  <span>
                    {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                  </span>
                </div>
                <motion.div
                  animate={{ rotate: theme === 'dark' ? 0 : 180 }}
                  transition={{ duration: 0.3 }}
                  className="w-6 h-3 rounded-full border"
                  style={{
                    backgroundColor: theme === 'dark' ? 'var(--button-primary-bg)' : 'var(--node-input-bg)',
                    borderColor: 'var(--node-border)'
                  }}
                >
                  <motion.div
                    animate={{ x: theme === 'dark' ? 12 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: 'var(--node-text)'
                    }}
                  />
                </motion.div>
              </motion.button>
            </div>
          </div>

          {/* Mode Toggle removed per design — agentic only */}
        </motion.div>
      </motion.div>

      {/* Context Side Panel */}
      <ContextPanel />

      {/* Backdrop */}
      {isMenuOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeMenu}
          className="absolute inset-0 z-40 bg-black/20 backdrop-blur-sm"
        />
      )}

      {/* Command+I Chat Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-6 left-6 z-50"
      >
        <motion.button
          onClick={openChat}
          className="flex items-center gap-2 px-4 py-3 glass-themed rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
          style={{
            background: 'var(--node-bg)',
            borderColor: 'var(--node-border)',
            boxShadow: 'var(--node-shadow)',
            color: 'var(--node-text)'
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}

        >
          <kbd className="px-2 py-1 rounded text-xs" style={{
            backgroundColor: 'var(--node-input-bg)',
            color: 'var(--node-text-muted)',
            border: '1px solid var(--node-border)'
          }}>⌘ + I</kbd>
        </motion.button>
      </motion.div>

      {/* Command+K Context Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-6 right-6 z-50"
      >
        <motion.button
          onClick={openContext}
          className="flex items-center gap-2 px-4 py-3 glass-themed rounded-2xl transition-all hover:bg-black/5 dark:hover:bg-white/5"
          style={{
            background: 'var(--node-bg)',
            borderColor: 'var(--node-border)',
            boxShadow: 'var(--node-shadow)',
            color: 'var(--node-text)'
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}

        >
          <kbd className="px-2 py-1 rounded text-xs" style={{
            backgroundColor: 'var(--node-input-bg)',
            color: 'var(--node-text-muted)',
            border: '1px solid var(--node-border)'
          }}>⌘ + K</kbd>
        </motion.button>
      </motion.div>

      {/* Compact Chat Bar */}
      <AgentChatBar />

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
            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
            style={{ color: 'var(--node-text)' }}
            title="Recent Requests"
          >
            <Clock className="w-4 h-4" />
            History
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
          nodesDraggable={!isChatOpen}
          nodesConnectable={!isChatOpen}
          elementsSelectable={!isChatOpen}
        >
        </ReactFlow>
      </div>

      {/* History Panel */}
      {isHistoryOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-20 right-6 z-50 w-96 glass-themed rounded-2xl"
          style={{ background: 'var(--node-bg)', borderColor: 'var(--node-border)', boxShadow: 'var(--node-shadow)' }}
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold" style={{ color: 'var(--node-text)' }}>Recent Requests</div>
              <button onClick={() => historyLog.clear()} className="text-xs px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--node-text-muted)' }}>Clear</button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {historyLog.items.length === 0 && (
                <div className="text-xs" style={{ color: 'var(--node-text-muted)' }}>No history yet</div>
              )}
              {historyLog.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between px-2 py-2 rounded-xl" style={{ background: 'var(--node-header-bg)', border: '1px solid var(--node-border)' }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--node-text)' }}>
                      <span className="font-mono">{it.method}</span>
                      <span className="truncate" title={it.url} style={{ color: 'var(--node-text-muted)' }}>
                        {(() => { try { return new URL(it.url).pathname; } catch { return it.url; } })()}
                      </span>
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>
                      {it.status ?? '-'} • {it.responseTime ?? '-'}ms
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      className="px-2 py-1 text-xs rounded-lg button-glass"
                      style={{ backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' }}
                      onClick={() => handleAddNodeFromRequestData({
                        url: it.request.url,
                        method: it.request.method,
                        headers: JSON.stringify(it.request.headers, null, 2),
                        data: typeof it.request.data === 'string' ? it.request.data : JSON.stringify(it.request.data, null, 2),
                        queryParams: it.request.queryParams || [],
                        useBearer: !!it.request.usedBearer,
                        bearerToken: '',
                        assertions: [],
                      })}
                    >
                      Add Node
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
