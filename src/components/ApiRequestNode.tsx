'use client';

import { useState, useCallback, memo } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send,
    Globe,
    Settings,
    Code,
    X,
    Plus,
    Maximize2,
    Minimize2
} from 'lucide-react';

interface RequestData {
    url: string;
    method: string;
    headers: string;
    data: string;
}

interface ApiRequestNodeProps {
    id: string;
    data: {
        label: string;
        onRequestSent: (nodeId: string, requestData: RequestData, response: any) => void;
        onDelete: (nodeId: string) => void;
    };
    selected?: boolean;
}

const ApiRequestNode = memo(({ id, data, selected }: ApiRequestNodeProps) => {
    const [request, setRequest] = useState<RequestData>({
        url: '',
        method: 'GET',
        headers: '',
        data: ''
    });

    const [loading, setLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const { fitView } = useReactFlow();

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!request.url) return;

        setLoading(true);

        try {
            // Parse headers
            let parsedHeaders = {};
            if (request.headers.trim()) {
                try {
                    parsedHeaders = JSON.parse(request.headers);
                } catch {
                    const headerLines = request.headers.split('\n');
                    parsedHeaders = headerLines.reduce((acc: any, line) => {
                        const [key, value] = line.split(':').map(s => s.trim());
                        if (key && value) {
                            acc[key] = value;
                        }
                        return acc;
                    }, {});
                }
            }

            // Parse request data
            let parsedData = null;
            if (request.data.trim()) {
                try {
                    parsedData = JSON.parse(request.data);
                } catch {
                    parsedData = request.data;
                }
            }

            const res = await fetch('/api/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: request.url,
                    method: request.method,
                    headers: parsedHeaders,
                    data: parsedData,
                }),
            });

            const result = await res.json();

            if (res.ok) {
                console.log('ApiRequestNode: Calling onRequestSent', { id, request, result });
                console.log('onRequestSent function:', data.onRequestSent);
                data.onRequestSent(id, request, result);
            } else {
                console.error('Request failed with status:', res.status, result);
            }
        } catch (err) {
            console.error('Request failed:', err);
        } finally {
            setLoading(false);
        }
    }, [request, id, data]);

    const handleFocus = useCallback(() => {
        fitView({ nodes: [{ id }], duration: 800 });
    }, [fitView, id]);

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`relative ${isExpanded ? 'w-96' : 'w-80'
                } bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 ${selected ? 'ring-2 ring-black/20' : ''
                }`}
        >
            <Handle type="source" position={Position.Right} className="w-3 h-3 bg-black/20" />
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-black/20" />

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-black/10">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-black/5 flex items-center justify-center">
                        <Globe className="w-3 h-3 text-black/60" />
                    </div>
                    <span className="font-medium text-sm text-black/80">API Request</span>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={handleFocus}
                        className="p-1.5 hover:bg-black/5 rounded-lg transition-colors"
                    >
                        <Maximize2 className="w-3 h-3 text-black/60" />
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 hover:bg-black/5 rounded-lg transition-colors"
                    >
                        {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                    </button>
                    <button
                        onClick={() => data.onDelete(id)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <X className="w-3 h-3 text-red-500" />
                    </button>
                </div>
            </div>

            {/* Compact Form */}
            <div className="p-4">
                <form onSubmit={handleSubmit} className="space-y-3">
                    {/* URL and Method */}
                    <div className="flex gap-2">
                        <select
                            value={request.method}
                            onChange={(e) => setRequest({ ...request, method: e.target.value })}
                            className="px-2 py-1.5 text-xs font-mono bg-black/5 rounded-lg border-0 focus:ring-1 focus:ring-black/20"
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                            <option value="PATCH">PATCH</option>
                        </select>

                        <input
                            type="url"
                            placeholder="https://api.example.com/endpoint"
                            value={request.url}
                            onChange={(e) => setRequest({ ...request, url: e.target.value })}
                            className="flex-1 px-3 py-1.5 text-xs bg-black/5 rounded-lg border-0 focus:ring-1 focus:ring-black/20 placeholder-black/40"
                            required
                        />
                    </div>

                    {/* Expanded Section */}
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="space-y-3"
                            >
                                {/* Headers */}
                                <div>
                                    <label className="block text-xs font-medium text-black/60 mb-1">
                                        Headers
                                    </label>
                                    <textarea
                                        placeholder='{"Authorization": "Bearer token"}'
                                        value={request.headers}
                                        onChange={(e) => setRequest({ ...request, headers: e.target.value })}
                                        rows={2}
                                        className="w-full px-2 py-1.5 text-xs font-mono bg-black/5 rounded-lg border-0 focus:ring-1 focus:ring-black/20 placeholder-black/40 resize-none"
                                    />
                                </div>

                                {/* Request Body */}
                                {['POST', 'PUT', 'PATCH'].includes(request.method) && (
                                    <div>
                                        <label className="block text-xs font-medium text-black/60 mb-1">
                                            Request Body
                                        </label>
                                        <textarea
                                            placeholder='{"key": "value"}'
                                            value={request.data}
                                            onChange={(e) => setRequest({ ...request, data: e.target.value })}
                                            rows={3}
                                            className="w-full px-2 py-1.5 text-xs font-mono bg-black/5 rounded-lg border-0 focus:ring-1 focus:ring-black/20 placeholder-black/40 resize-none"
                                        />
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Send Button */}
                    <button
                        type="submit"
                        disabled={loading || !request.url}
                        className="w-full bg-black text-white py-2 px-3 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="w-3 h-3" />
                                Send Request
                            </>
                        )}
                    </button>
                </form>
            </div>
        </motion.div>
    );
});

ApiRequestNode.displayName = 'ApiRequestNode';

export default ApiRequestNode;
