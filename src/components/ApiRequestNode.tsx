'use client';

import { useState, useCallback, memo, useEffect } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { useEnv } from '@/contexts/EnvContext';
import { useHistoryLog } from '@/contexts/HistoryContext';
import { Assertion, RequestData } from '@/types';
import {
    Send,
    Globe,
    Code,
    X,
    Plus,
    Maximize2,
    Minimize2,
    Edit3,
    Check
} from 'lucide-react';

interface ApiRequestNodeProps {
    id: string;
    data: {
        label: string;
        name?: string;
        initialRequest?: RequestData;
        onRequestSent: (
            nodeId: string,
            requestData: RequestData,
            response: any,
            meta?: { assertions?: Assertion[]; results?: { id: string; passed: boolean; description: string }[] }
        ) => void;
        onDelete: (nodeId: string) => void;
        onNameChange?: (nodeId: string, newName: string) => void;
    };
    selected?: boolean;
}

const ApiRequestNode = memo(({ id, data, selected }: ApiRequestNodeProps) => {
    const { theme } = useTheme();
    const { resolveString, resolveDeep, token: envToken, baseUrl: envBaseUrl } = useEnv();
    const history = useHistoryLog();
    const [request, setRequest] = useState<RequestData>({
        url: '',
        method: 'GET',
        headers: '',
        data: '',
        queryParams: [],
        useBearer: false,
        bearerToken: '',
        assertions: [],
    });

    const [loading, setLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [currentName, setCurrentName] = useState(data.name || 'API Request');
    const { fitView } = useReactFlow();

    useEffect(() => {
        if (data.initialRequest) {
            setRequest((prev) => ({
                ...prev,
                ...data.initialRequest,
            }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
            // Build URL with env substitution and query params
            let resolvedUrl = resolveString(request.url);
            if (resolvedUrl.startsWith('/')) {
                const base = envBaseUrl ? envBaseUrl.replace(/\/$/, '') : '';
                resolvedUrl = `${base}${resolvedUrl}`;
            }
            try {
                // if user placed {{baseUrl}} in URL, it's already resolved above
                const u = new URL(resolvedUrl);
                // apply query params
                (request.queryParams || []).forEach(({ key, value }) => {
                    if (key) u.searchParams.set(resolveString(key), resolveString(value));
                });
                resolvedUrl = u.toString();
            } catch {}

            // Bearer token header (unless explicitly set)
            const useBearer = request.useBearer;
            const bearerToken = request.bearerToken?.trim() || envToken || '';
            if (useBearer && bearerToken && !(parsedHeaders as any)['Authorization']) {
                (parsedHeaders as any)['Authorization'] = `Bearer ${resolveString(bearerToken)}`;
            }

            // Resolve env placeholders inside headers and data
            parsedHeaders = resolveDeep(parsedHeaders);
            parsedData = resolveDeep(parsedData);

            const res = await fetch('/api/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: resolvedUrl,
                    method: request.method,
                    headers: parsedHeaders,
                    data: parsedData,
                }),
            });

            const result = await res.json();

            if (res.ok) {
                // Basic response validation
                const assertions = request.assertions || [];
                const results = assertions.map((a) => {
                    try {
                        if (a.type === 'status') {
                            const passed = Number(result.status) === Number(a.equals);
                            return { id: a.id, passed, description: `Status equals ${a.equals}` };
                        }
                        if (a.type === 'bodyContains') {
                            const bodyStr = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
                            const passed = bodyStr.includes(a.text);
                            return { id: a.id, passed, description: `Body contains "${a.text}"` };
                        }
                        if (a.type === 'headerContains') {
                            const hv = (result.headers || {})[a.header.toLowerCase()] || (result.headers || {})[a.header];
                            const hvStr = hv != null ? String(hv) : '';
                            const passed = hvStr.includes(a.text);
                            return { id: a.id, passed, description: `Header ${a.header} contains "${a.text}"` };
                        }
                        return { id: 'unknown', passed: false, description: 'Unknown assertion' };
                    } catch {
                        return { id: 'unknown', passed: false, description: 'Assertion error' };
                    }
                });

                // Log to history
                history.add({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    timestamp: Date.now(),
                    method: request.method,
                    url: result.url || resolvedUrl,
                    status: result.status,
                    responseTime: result.responseTime,
                    success: true,
                    request: {
                        url: resolvedUrl,
                        method: request.method,
                        headers: (parsedHeaders as any) || {},
                        data: parsedData,
                        queryParams: request.queryParams,
                        usedBearer: useBearer,
                    },
                });

                data.onRequestSent(id, request, result, { assertions, results });
            } else {
                console.error('Request failed with status:', res.status, result);
                history.add({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                    timestamp: Date.now(),
                    method: request.method,
                    url: resolvedUrl,
                    status: result?.status ?? res.status,
                    responseTime: result?.responseTime,
                    success: false,
                    request: {
                        url: resolvedUrl,
                        method: request.method,
                        headers: (parsedHeaders as any) || {},
                        data: parsedData,
                        queryParams: request.queryParams,
                        usedBearer: useBearer,
                    },
                });
            }
        } catch (err) {
            console.error('Request failed:', err);
        } finally {
            setLoading(false);
        }
    }, [request, id, data, resolveString, resolveDeep, envBaseUrl, envToken, history]);

    const handleFocus = useCallback(() => {
        fitView({ nodes: [{ id }], duration: 800 });
    }, [fitView, id]);

    const handleNameEdit = useCallback(() => {
        setIsEditingName(true);
    }, []);

    const handleNameSave = useCallback(() => {
        setIsEditingName(false);
        if (data.onNameChange && currentName.trim()) {
            data.onNameChange(id, currentName.trim());
        }
    }, [data, id, currentName]);

    const handleNameCancel = useCallback(() => {
        setIsEditingName(false);
        setCurrentName(data.name || 'API Request');
    }, [data.name]);

    const handleNameKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNameSave();
        } else if (e.key === 'Escape') {
            handleNameCancel();
        }
    }, [handleNameSave, handleNameCancel]);

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`group relative ${isExpanded ? 'w-96' : 'w-80'} glass-themed rounded-3xl ${selected ? 'ring-2' : ''}`}
            style={{
                background: 'var(--node-bg)',
                borderColor: 'var(--node-border)',
                boxShadow: 'var(--node-shadow)',
                ...(selected && {
                    ringColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)'
                })
            }}
        >
            <Handle
                type="source"
                position={Position.Right}
                className="w-3 h-3"
                style={{ backgroundColor: 'var(--node-text-muted)' }}
            />
            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3"
                style={{ backgroundColor: 'var(--node-text-muted)' }}
            />

            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b node-header" style={{ borderColor: 'var(--node-border)' }}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--node-input-bg)' }}>
                        <Globe className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                    </div>
                    {isEditingName ? (
                        <div className="flex items-center gap-1 flex-1">
                            <input
                                type="text"
                                value={currentName}
                                onChange={(e) => setCurrentName(e.target.value)}
                                onKeyDown={handleNameKeyPress}
                                onBlur={handleNameSave}
                                className="flex-1 px-2 py-1 text-sm font-medium rounded focus:outline-none focus:ring-1 node-input"
                                style={{
                                    backgroundColor: 'var(--node-input-bg)',
                                    borderColor: 'var(--node-border)',
                                    color: 'var(--node-text)'
                                }}
                                autoFocus
                                maxLength={50}
                            />
                            <button
                                onClick={handleNameSave}
                                className="p-1 hover:bg-green-50 rounded transition-colors"
                                title="Save name"
                            >
                                <Check className="w-3 h-3 text-green-600" />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <span
                                className="font-medium text-sm truncate"
                                title={currentName}
                                style={{ color: 'var(--node-text)' }}
                            >
                                {currentName}
                            </span>
                            <button
                                onClick={handleNameEdit}
                                className="p-1 rounded transition-colors opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5"
                                title="Edit name"
                            >
                                <Edit3 className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={handleFocus}
                        className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        <Maximize2 className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                    </button>
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        {isExpanded ?
                            <Minimize2 className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} /> :
                            <Plus className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                        }
                    </button>
                    <button
                        onClick={() => data.onDelete(id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
                            className="px-2 py-1.5 text-xs font-mono rounded-lg border-0 focus:ring-1 node-input"
                            style={{
                                backgroundColor: 'var(--node-input-bg)',
                                color: 'var(--node-text)',
                                borderColor: 'var(--node-border)'
                            }}
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
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                            style={{
                                backgroundColor: 'var(--node-input-bg)',
                                color: 'var(--node-text)',
                                borderColor: 'var(--node-border)'
                            }}
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
                                {/* Query Params */}
                                <div>
                                    <label
                                        className="block text-xs font-medium mb-1"
                                        style={{ color: 'var(--node-text-muted)' }}
                                    >
                                        Query Parameters
                                    </label>
                                    <div className="space-y-2">
                                        {(request.queryParams || []).map((qp, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <input
                                                    type="text"
                                                    placeholder="key"
                                                    value={qp.key}
                                                    onChange={(e) => {
                                                        const arr = [...(request.queryParams || [])];
                                                        arr[idx] = { ...arr[idx], key: e.target.value };
                                                        setRequest({ ...request, queryParams: arr });
                                                    }}
                                                    className="w-1/2 px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                                                    style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="value"
                                                    value={qp.value}
                                                    onChange={(e) => {
                                                        const arr = [...(request.queryParams || [])];
                                                        arr[idx] = { ...arr[idx], value: e.target.value };
                                                        setRequest({ ...request, queryParams: arr });
                                                    }}
                                                    className="w-1/2 px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                                                    style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const arr = [...(request.queryParams || [])];
                                                        arr.splice(idx, 1);
                                                        setRequest({ ...request, queryParams: arr });
                                                    }}
                                                    className="px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                                                    title="Remove"
                                                >
                                                    <X className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setRequest({ ...request, queryParams: [...(request.queryParams || []), { key: '', value: '' }] })}
                                            className="px-2 py-1.5 text-xs rounded-lg button-glass"
                                            style={{ backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' }}
                                        >
                                            + Add Param
                                        </button>
                                    </div>
                                </div>

                                {/* Headers */}
                                <div>
                                    <label
                                        className="block text-xs font-medium mb-1"
                                        style={{ color: 'var(--node-text-muted)' }}
                                    >
                                        Headers
                                    </label>
                                    <textarea
                                        placeholder='{"Authorization": "Bearer token"}'
                                        value={request.headers}
                                        onChange={(e) => setRequest({ ...request, headers: e.target.value })}
                                        rows={2}
                                        className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border-0 focus:ring-1 resize-none node-input"
                                        style={{
                                            backgroundColor: 'var(--node-input-bg)',
                                            color: 'var(--node-text)',
                                            borderColor: 'var(--node-border)'
                                        }}
                                    />
                                </div>

                                {/* Bearer Token */}
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--node-text-muted)' }}>
                                        <input
                                            type="checkbox"
                                            checked={!!request.useBearer}
                                            onChange={(e) => setRequest({ ...request, useBearer: e.target.checked })}
                                        />
                                        Use Bearer Token
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={envToken ? 'Using {{token}}' : 'Enter token or use {{token}}'}
                                        value={request.bearerToken ?? ''}
                                        onChange={(e) => setRequest({ ...request, bearerToken: e.target.value })}
                                        className="flex-1 px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                                        style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                                    />
                                </div>

                                {/* Request Body */}
                                {['POST', 'PUT', 'PATCH'].includes(request.method) && (
                                    <div>
                                        <label
                                            className="block text-xs font-medium mb-1"
                                            style={{ color: 'var(--node-text-muted)' }}
                                        >
                                            Request Body
                                        </label>
                                        <textarea
                                            placeholder='{"key": "value"}'
                                            value={request.data}
                                            onChange={(e) => setRequest({ ...request, data: e.target.value })}
                                            rows={3}
                                            className="w-full px-2 py-1.5 text-xs font-mono rounded-lg border-0 focus:ring-1 resize-none node-input"
                                            style={{
                                                backgroundColor: 'var(--node-input-bg)',
                                                color: 'var(--node-text)',
                                                borderColor: 'var(--node-border)'
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Assertions */}
                                <div>
                                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--node-text-muted)' }}>
                                        Assertions
                                    </label>
                                    <div className="space-y-2">
                                        {(request.assertions || []).map((a, idx) => (
                                            <div key={a.id} className="flex items-center gap-2">
                                                <select
                                                    value={a.type}
                                                    onChange={(e) => {
                                                        const type = e.target.value as Assertion['type'];
                                                        const arr = [...(request.assertions || [])];
                                                        let next: Assertion;
                                                        if (type === 'status') next = { id: a.id, type: 'status', equals: 200 };
                                                        else if (type === 'bodyContains') next = { id: a.id, type: 'bodyContains', text: '' };
                                                        else next = { id: a.id, type: 'headerContains', header: '', text: '' };
                                                        arr[idx] = next;
                                                        setRequest({ ...request, assertions: arr });
                                                    }}
                                                    className="px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                                                    style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                                                >
                                                    <option value="status">Status equals</option>
                                                    <option value="bodyContains">Body contains</option>
                                                    <option value="headerContains">Header contains</option>
                                                </select>

                                                {a.type === 'status' && (
                                                    <input
                                                        type="number"
                                                        value={a.equals}
                                                        onChange={(e) => {
                                                            const arr = [...(request.assertions || [])] as any;
                                                            arr[idx] = { ...a, equals: Number(e.target.value) };
                                                            setRequest({ ...request, assertions: arr });
                                                        }}
                                                        className="w-24 px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                                                        style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                                                    />
                                                )}

                                                {a.type === 'bodyContains' && (
                                                    <input
                                                        type="text"
                                                        placeholder="text"
                                                        value={a.text}
                                                        onChange={(e) => {
                                                            const arr = [...(request.assertions || [])] as any;
                                                            arr[idx] = { ...a, text: e.target.value };
                                                            setRequest({ ...request, assertions: arr });
                                                        }}
                                                        className="flex-1 px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                                                        style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                                                    />
                                                )}

                                                {a.type === 'headerContains' && (
                                                    <>
                                                        <input
                                                            type="text"
                                                            placeholder="header"
                                                            value={a.header}
                                                            onChange={(e) => {
                                                                const arr = [...(request.assertions || [])] as any;
                                                                arr[idx] = { ...a, header: e.target.value };
                                                                setRequest({ ...request, assertions: arr });
                                                            }}
                                                            className="w-32 px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                                                            style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                                                        />
                                                        <input
                                                            type="text"
                                                            placeholder="contains"
                                                            value={a.text}
                                                            onChange={(e) => {
                                                                const arr = [...(request.assertions || [])] as any;
                                                                arr[idx] = { ...a, text: e.target.value };
                                                                setRequest({ ...request, assertions: arr });
                                                            }}
                                                            className="flex-1 px-2 py-1.5 text-xs rounded-lg border-0 focus:ring-1 node-input"
                                                            style={{ backgroundColor: 'var(--node-input-bg)', color: 'var(--node-text)', borderColor: 'var(--node-border)' }}
                                                        />
                                                    </>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const arr = [...(request.assertions || [])];
                                                        arr.splice(idx, 1);
                                                        setRequest({ ...request, assertions: arr });
                                                    }}
                                                    className="px-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                                                    title="Remove"
                                                >
                                                    <X className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => setRequest({ ...request, assertions: [...(request.assertions || []), { id: `${Date.now()}-${Math.random().toString(36).slice(2,6)}`, type: 'status', equals: 200 }] })}
                                            className="px-2 py-1.5 text-xs rounded-lg button-glass"
                                            style={{ backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' }}
                                        >
                                            + Add Assertion
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Send Button */}
                    <button
                        type="submit"
                        disabled={loading || !request.url}
                        className="w-full py-2 px-3 rounded-lg text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 button-glass"
                        style={{
                            backgroundColor: 'var(--button-primary-bg)',
                            color: 'var(--button-primary-text)'
                        }}
                    >
                        {loading ? (
                            <>
                                <div
                                    className="w-3 h-3 rounded-full animate-spin"
                                    style={{
                                        border: '2px solid',
                                        borderColor: 'var(--button-primary-text)',
                                        borderTopColor: 'transparent'
                                    }}
                                />
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
