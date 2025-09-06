'use client';

import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { Assertion, AssertionResult, ResponseData, RequestData } from '@/types';
import {
    CheckCircle,
    XCircle,
    AlertCircle,
    Clock,
    Copy,
    Code,
    Eye,
    EyeOff,
    X,
    Edit3,
    Check,
    Braces,
    ChevronRight,
    ChevronDown,
    ChevronLeft,
    Search,
    Image as ImageIcon,
    Table as TableIcon,
    WrapText,
    Download,
    ExternalLink
} from 'lucide-react';

interface ResponseNodeProps {
    id: string;
    data: {
        response: ResponseData;
        requestData: RequestData;
        assertions?: Assertion[];
        assertionResults?: AssertionResult[];
        name?: string;
        onDelete?: (nodeId: string) => void;
        onNameChange?: (nodeId: string, newName: string) => void;
    };
    selected?: boolean;
}

const ResponseNode = memo(({ id, data, selected }: ResponseNodeProps) => {
    const { theme } = useTheme();
    const [showDetails, setShowDetails] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const { response, requestData } = data;
    const [currentName, setCurrentName] = useState(data.name || `Response ${response.status}`);
    const [activeTab, setActiveTab] = useState<'tree' | 'raw' | 'html' | 'image' | 'table'>('raw');
    const [wrapRaw, setWrapRaw] = useState(true);
    const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
    const [htmlViewMode, setHtmlViewMode] = useState<'preview' | 'source'>('preview');
    const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
    const [viewerMaxHeight, setViewerMaxHeight] = useState<number>(384); // px ~ 24rem
    const [nodeWidth, setNodeWidth] = useState<number>(512); // px ~ 32rem
    const [isResizingHeight, setIsResizingHeight] = useState(false);
    const [isResizingWidth, setIsResizingWidth] = useState(false);
    const viewerRef = useRef<HTMLDivElement | null>(null);
    const rawMatchRef = useRef<HTMLSpanElement | null>(null);
    const pathRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const [searchQuery, setSearchQuery] = useState('');
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    const [selectedPath, setSelectedPath] = useState<string>('');
    const [defaultCollapseLevel] = useState<number>(2);
    const [isExpandMenuOpen, setIsExpandMenuOpen] = useState(false);
    const expandMenuRef = useRef<HTMLDivElement | null>(null);
    const passFail = useMemo(() => {
        const arr = data.assertionResults || [];
        const passed = arr.filter(r => r.passed).length;
        const failed = arr.length - passed;
        return { passed, failed };
    }, [data.assertionResults]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
    };
    const copyText = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {}
    }, []);

    const handleNameEdit = () => {
        setIsEditingName(true);
    };

    const handleNameSave = () => {
        setIsEditingName(false);
        if (data.onNameChange && currentName.trim()) {
            data.onNameChange(id, currentName.trim());
        }
    };

    const handleNameCancel = () => {
        setIsEditingName(false);
        setCurrentName(data.name || `Response ${response.status}`);
    };

    const handleNameKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleNameSave();
        } else if (e.key === 'Escape') {
            handleNameCancel();
        }
    };

    const getStatusColor = () => {
        if (response.status >= 200 && response.status < 300) {
            return 'text-green-700 bg-green-50 border-green-200';
        } else if (response.status >= 400) {
            return 'text-red-700 bg-red-50 border-red-200';
        } else {
            return 'text-yellow-700 bg-yellow-50 border-yellow-200';
        }
    };

    const getStatusIcon = () => {
        if (response.status >= 200 && response.status < 300) {
            return <CheckCircle className="w-3 h-3" />;
        } else if (response.status >= 400) {
            return <XCircle className="w-3 h-3" />;
        } else {
            return <AlertCircle className="w-3 h-3" />;
        }
    };

    // Content-type helpers
    const contentType = useMemo(() => {
        const h = response.headers || {};
        const ctEntry = Object.entries(h).find(([k]) => k.toLowerCase() === 'content-type');
        const ct = ctEntry ? ctEntry[1] : '';
        return String(ct).toLowerCase();
    }, [response.headers]);

    const isJson = useMemo(() => {
        if (contentType.includes('application/json')) return true;
        // If data is already an object/array
        return typeof response.data === 'object' && response.data !== null;
    }, [contentType, response.data]);

    const isHtml = useMemo(() => contentType.includes('text/html'), [contentType]);
    const isImage = useMemo(() => contentType.startsWith('image/'), [contentType]);

    // Body representations
    const bodyText = useMemo(() => {
        try {
            if (typeof response.data === 'string') return response.data;
            return JSON.stringify(response.data, null, 2);
        } catch {
            return String(response.data ?? '');
        }
    }, [response.data]);

    const bodyJson = useMemo(() => {
        if (isJson) {
            if (typeof response.data === 'object') return response.data;
            try {
                return JSON.parse(bodyText);
            } catch {}
        }
        return undefined;
    }, [isJson, response.data, bodyText]);

    const isArrayOfObjects = useMemo(() => {
        return Array.isArray(bodyJson) && bodyJson.every((it) => it && typeof it === 'object' && !Array.isArray(it));
    }, [bodyJson]);

    // Initialize sensible default tab based on content type/body
    useEffect(() => {
        if (isImage) setActiveTab('image');
        else if (isHtml) setActiveTab('html');
        else if (isJson) setActiveTab('tree');
        else setActiveTab('raw');
    }, [isImage, isHtml, isJson]);

    // Table columns initialization
    const allColumns = useMemo(() => {
        if (!isArrayOfObjects) return [] as string[];
        const rows = Array.isArray(bodyJson) ? (bodyJson as Array<Record<string, unknown>>) : [];
        const cols = new Set<string>();
        for (let i = 0; i < Math.min(rows.length, 50); i++) {
            const r = rows[i];
            Object.keys(r || {}).forEach((k) => cols.add(k));
        }
        return Array.from(cols);
    }, [isArrayOfObjects, bodyJson]);

    useEffect(() => {
        if (isArrayOfObjects) {
            setVisibleColumns(allColumns);
        } else {
            setVisibleColumns([]);
        }
    }, [isArrayOfObjects, allColumns]);

    // Initialize default collapsed state by depth
    const collectPathsWithDepth = useCallback((obj: unknown, base: string = '$', depth = 0): { path: string; depth: number }[] => {
        const out: { path: string; depth: number }[] = [];
        if (obj && typeof obj === 'object') {
            out.push({ path: base, depth });
            if (Array.isArray(obj)) {
                obj.forEach((v, i) => out.push(...collectPathsWithDepth(v, `${base}[${i}]`, depth + 1)));
            } else {
                Object.keys(obj as Record<string, unknown>).forEach((k) => out.push(...collectPathsWithDepth((obj as Record<string, unknown>)[k], `${base}.${k}` , depth + 1)));
            }
        }
        return out;
    }, []);

    useEffect(() => {
        if (!bodyJson) return;
        const all = collectPathsWithDepth(bodyJson);
        const collapsed = new Set<string>();
        all.forEach(({ path, depth }) => {
            if (depth > defaultCollapseLevel) collapsed.add(path);
        });
        setCollapsedPaths(collapsed);
    }, [bodyJson, defaultCollapseLevel, collectPathsWithDepth]);

    // Resize handlers
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (isResizingHeight) {
                setViewerMaxHeight((prev) => {
                    const delta = e.movementY;
                    const next = Math.max(200, Math.min(800, prev + delta));
                    return next;
                });
            }
            if (isResizingWidth) {
                setNodeWidth((prev) => {
                    const delta = e.movementX;
                    const next = Math.max(420, Math.min(900, prev + delta));
                    return next;
                });
            }
        };
        const onUp = () => {
            setIsResizingHeight(false);
            setIsResizingWidth(false);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isResizingHeight, isResizingWidth]);

    // Close dropdowns on outside click
    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (isExpandMenuOpen && expandMenuRef.current && !expandMenuRef.current.contains(e.target as Node)) {
                setIsExpandMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [isExpandMenuOpen]);

    // Search utilities
    const escapeReg = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const norm = (s: string) => s.toLowerCase();

    const rawMatches = useMemo(() => {
        if (!searchQuery) return [] as { start: number; end: number }[];
        const q = norm(searchQuery);
        const t = norm(bodyText);
        const res: { start: number; end: number }[] = [];
        let idx = 0;
        while (true) {
            const i = t.indexOf(q, idx);
            if (i === -1) break;
            res.push({ start: i, end: i + q.length });
            idx = i + q.length;
        }
        return res;
    }, [searchQuery, bodyText]);

    const collectTreeMatches = useCallback((obj: unknown, base: string = '$', out: string[] = []) => {
        if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
                obj.forEach((v, i) => collectTreeMatches(v, `${base}[${i}]`, out));
            } else {
                Object.keys(obj as Record<string, unknown>).forEach((k) => {
                    if (searchQuery && norm(k).includes(norm(searchQuery))) out.push(`${base}.${k}`);
                    collectTreeMatches((obj as Record<string, unknown>)[k], `${base}.${k}`, out);
                });
            }
        } else if (obj != null) {
            const val = String(obj);
            if (searchQuery && norm(val).includes(norm(searchQuery))) out.push(base);
        }
        return out;
    }, [searchQuery]);

    const treeMatches = useMemo(() => {
        if (!searchQuery || !bodyJson) return [] as string[];
        const arr = collectTreeMatches(bodyJson);
        // Deduplicate
        return Array.from(new Set(arr));
    }, [searchQuery, bodyJson, collectTreeMatches]);

    useEffect(() => {
        setCurrentMatchIndex(0);
    }, [searchQuery, activeTab]);

    const matchesCount = activeTab === 'raw' ? rawMatches.length : activeTab === 'tree' ? treeMatches.length : 0;

    const goToMatch = useCallback((idx: number) => {
        if (matchesCount === 0) return;
        const next = (idx + matchesCount) % matchesCount;
        setCurrentMatchIndex(next);
        if (activeTab === 'raw') {
            setTimeout(() => rawMatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
        } else if (activeTab === 'tree') {
            const targetPath = treeMatches[next];
            if (targetPath) {
                // Expand ancestors
                const ancestorPaths: string[] = [];
                const re = /(?:\.[^.[\]]+|\[[0-9]+\])/g;
                let acc = '$';
                const parts = targetPath.match(re) || [];
                parts.forEach((p) => {
                    acc += p;
                    ancestorPaths.push(acc);
                });
                setCollapsedPaths((prev) => {
                    const s = new Set(prev);
                    ancestorPaths.forEach((p) => s.delete(p));
                    return s;
                });
                setTimeout(() => {
                    const el = pathRefs.current.get(targetPath);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 0);
            }
        }
    }, [matchesCount, activeTab, treeMatches]);

    const nextMatch = useCallback(() => goToMatch(currentMatchIndex + 1), [goToMatch, currentMatchIndex]);
    const prevMatch = useCallback(() => goToMatch(currentMatchIndex - 1), [goToMatch, currentMatchIndex]);

    // JSONPath jump
    const jumpToPath = useCallback((path: string) => {
        if (!path || !bodyJson) return;
        const target = path.trim().startsWith('$') ? path.trim() : '$.' + path.trim();
        setActiveTab('tree');
        // Expand ancestors
        const ancestorPaths: string[] = [];
        const re = /(?:\.[^.[\]]+|\[[0-9]+\])/g;
        let acc = '$';
        const parts = target.match(re) || [];
        parts.forEach((p) => { acc += p; ancestorPaths.push(acc); });
        setCollapsedPaths((prev) => {
            const s = new Set(prev);
            ancestorPaths.forEach((p) => s.delete(p));
            return s;
        });
        setSelectedPath(target);
        setTimeout(() => {
            const el = pathRefs.current.get(target);
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 0);
    }, [bodyJson]);

    const breadcrumbParts = useMemo(() => {
        const p = selectedPath || '$';
        if (p === '$') return ['$'];
        const parts: string[] = ['$'];
        const re = /(?:\.[^.[\]]+|\[[0-9]+\])/g;
        const ms = p.match(re) || [];
        let acc = '$';
        ms.forEach((m) => { acc += m; parts.push(acc); });
        return parts;
    }, [selectedPath]);

    // helper highlight renderer
    const highlightFrag = (text: string, query: string, options?: { markIndex?: number; refCb?: (el: HTMLSpanElement | null) => void }) => {
        if (!query) return [text];
        const re = new RegExp(`(${escapeReg(query)})`, 'ig');
        const parts = text.split(re);
        let matchIdx = -1;
        return parts.map((part, i) => {
            const isMatch = i % 2 === 1;
            if (!isMatch) return <span key={i}>{part}</span>;
            matchIdx += 1;
            const isCurrent = options?.markIndex != null && matchIdx === options.markIndex;
            return (
                <span
                    key={i}
                    ref={isCurrent ? options?.refCb : undefined}
                    className={isCurrent ? 'bg-yellow-300/50 rounded px-0.5' : 'bg-yellow-200/30 rounded px-0.5'}
                    style={{ color: 'var(--node-text)' }}
                >{part}</span>
            );
        });
    };

    // Collapse/Expand helpers
    const collectContainerPaths = useCallback((obj: unknown, base: string = '$'): string[] => {
        const paths: string[] = [];
        if (obj && typeof obj === 'object') {
            paths.push(base);
            if (Array.isArray(obj)) {
                obj.forEach((v, i) => paths.push(...collectContainerPaths(v, `${base}[${i}]`)));
            } else {
                Object.keys(obj as Record<string, unknown>).forEach((k) => paths.push(...collectContainerPaths((obj as Record<string, unknown>)[k], `${base}.${k}`)));
            }
        }
        return paths;
    }, []);

    // expand/collapse helpers removed for compact toolbar

    const togglePath = useCallback((path: string) => {
        setCollapsedPaths((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path); else next.add(path);
            return next;
        });
    }, []);

    const currentTreeMatchPath = useMemo(() => (activeTab === 'tree' && treeMatches.length > 0) ? treeMatches[currentMatchIndex] : undefined, [activeTab, treeMatches, currentMatchIndex]);

    // JSON Node renderer
    const JsonNode = ({ value, k, path, depth }: { value: unknown; k?: string; path: string; depth: number }) => {
        const isArr = Array.isArray(value);
        const isContainer = (!isArr && typeof value === 'object' && value !== null) || isArr;
        const collapsed = collapsedPaths.has(path);
        const padding = 8 + depth * 12;

        const type = value === null ? 'null' : isArr ? 'array' : typeof value;
        const typeColor = type === 'string' ? '#16a34a' /* green-600 */
            : type === 'number' ? '#d97706' /* amber-600 */
            : type === 'boolean' ? '#7c3aed' /* violet-600 */
            : type === 'null' ? '#6b7280' /* gray-500 */
            : '#0ea5e9'; // sky-500

        return (
            <div className="text-xs" style={{ paddingLeft: padding }}>
                <div
                    ref={(el) => { if (el) pathRefs.current.set(path, el); }}
                    className={`flex items-center gap-1 py-0.5 rounded ${selectedPath === path ? 'bg-black/5 dark:bg-white/5' : ''} ${currentTreeMatchPath === path ? 'ring-1' : ''}`}
                    onClick={(e) => { e.stopPropagation(); setSelectedPath(path); }}
                    style={{ borderColor: 'var(--node-border)' }}
                >
                    {isContainer ? (
                        <button
                            onClick={() => togglePath(path)}
                            className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
                            title={collapsed ? 'Expand' : 'Collapse'}
                        >
                            {collapsed ? <ChevronRight className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} /> : <ChevronDown className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />}
                        </button>
                    ) : (
                        <span className="w-3 inline-block" />
                    )}

                    {k != null && (
                        <span className="font-mono" style={{ color: 'var(--node-text)' }}>
                            {searchQuery ? highlightFrag(String(k), searchQuery) : k}
                            :
                        </span>
                    )}

                    {!isContainer && (
                        <span className="font-mono" style={{ color: typeColor }}>
                            {(() => {
                                const s = typeof value === 'string' ? JSON.stringify(value) : String(value);
                                return searchQuery ? highlightFrag(s, searchQuery) : s;
                            })()}
                        </span>
                    )}

                    {isContainer && (
                        <span className="font-mono" style={{ color: 'var(--node-text-muted)' }}>
                            {isArr ? `Array(${(value as Array<unknown>).length})` : 'Object'}
                        </span>
                    )}

                    {/* Copy value */}
                    <button
                        onClick={() => copyText(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}
                        className="ml-auto px-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                        title="Copy value"
                    >
                        <Copy className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                    </button>
                </div>

                {isContainer && !collapsed && (
                    <div className="space-y-0.5">
                        {isArr
                            ? (value as Array<unknown>).map((v, i) => (
                                <JsonNode key={i} value={v} k={String(i)} path={`${path}[${i}]`} depth={depth + 1} />
                            ))
                            : Object.keys(value as Record<string, unknown>).map((ck) => (
                                <JsonNode key={ck} value={(value as Record<string, unknown>)[ck]} k={ck} path={`${path}.${ck}`} depth={depth + 1} />
                            ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`group relative glass-themed rounded-3xl ${selected ? 'ring-2' : ''}`}
            style={{
                background: 'var(--node-bg)',
                borderColor: 'var(--node-border)',
                boxShadow: 'var(--node-shadow)',
                width: nodeWidth,
                ...(selected && {
                    ringColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)'
                })
            }}
        >
            {/* Right-side width resizer */}
            <div
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsResizingWidth(true); }}
                className="absolute top-0 right-0 h-full w-1 cursor-ew-resize"
                style={{ background: 'transparent' }}
            />
            <Handle
                type="target"
                position={Position.Left}
                className="w-3 h-3"
                style={{ backgroundColor: 'var(--node-text-muted)' }}
            />

            {/* Header */}
            <div className="p-4 border-b node-header" style={{ borderColor: 'var(--node-border)' }}>
                {/* Title and Actions Row */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                        {isEditingName ? (
                            <div className="flex items-center gap-1 flex-1">
                                <input
                                    type="text"
                                    value={currentName}
                                    onChange={(e) => setCurrentName(e.target.value)}
                                    onKeyDown={handleNameKeyPress}
                                    onBlur={handleNameSave}
                                    className="flex-1 px-2 py-1 text-xs font-medium rounded focus:outline-none focus:ring-1 node-input"
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
                                    className="text-xs font-medium truncate"
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
                            onClick={() => setShowDetails(!showDetails)}
                            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                            {showDetails ?
                                <EyeOff className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} /> :
                                <Eye className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                            }
                        </button>
                        <button
                            onClick={handleCopy}
                            className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors"
                        >
                            <Copy className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                        </button>
                        {data.onDelete && (
                            <button
                                onClick={() => data.onDelete?.(id)}
                                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Delete this response node"
                            >
                                <X className="w-3 h-3 text-red-500" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Method and URL Row */}
                <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--node-text-muted)' }}>
                    <span className="font-mono">{requestData.method}</span>
                    <span className="truncate">
                        {(() => { try { return new URL(requestData.url).pathname; } catch { return requestData.url; } })()}
                    </span>
                </div>

                {/* Status and Time */}
                <div className="flex justify-between items-center">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor()}`}>
                        {getStatusIcon()}
                        {response.status} {response.statusText}
                    </div>

                    <div className="flex items-center gap-2">
                        {typeof response.fromCache !== 'undefined' && (
                            <div
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${response.fromCache ? 'text-green-700 bg-green-50 border-green-200' : 'text-gray-700 bg-gray-50 border-gray-200'}`}
                                title={response.fromCache ? 'Served from cache' : 'Fetched from origin'}
                            >
                                {response.fromCache ? 'Cache: HIT' : 'Cache: MISS'}
                            </div>
                        )}
                        <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--node-text-muted)' }}>
                            <Clock className="w-3 h-3" />
                            {response.responseTime}ms
                        </div>
                        {(data.assertionResults && data.assertionResults.length > 0) && (
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${passFail.failed === 0 ? 'text-green-700 bg-green-50 border-green-200' : 'text-yellow-700 bg-yellow-50 border-yellow-200'}`}>
                                <Check className="w-3 h-3" />
                                {passFail.passed}/{data.assertionResults.length} passed
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Response Preview */}
            <div className="p-4">
                {showDetails ? (
                    <div className="space-y-3">
                        {(data.assertionResults && data.assertionResults.length > 0) && (
                            <div>
                                <h4 className="text-xs font-medium mb-1" style={{ color: 'var(--node-text-muted)' }}>Assertions</h4>
                                <ul className="space-y-1">
                                    {data.assertionResults.map((r) => (
                                        <li key={r.id} className={`px-2 py-1 rounded text-xs border ${r.passed ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}>
                                            {r.passed ? '✓' : '×'} {r.description}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {/* Response Headers */}
                        <div>
                            <h4 className="text-xs font-medium mb-1" style={{ color: 'var(--node-text-muted)' }}>Headers</h4>
                            <pre
                                className="rounded-lg p-2 text-xs font-mono overflow-x-auto max-h-56 overflow-y-auto"
                                style={{
                                    backgroundColor: 'var(--node-input-bg)',
                                    color: 'var(--node-text)'
                                }}
                            >
                                {JSON.stringify(response.headers, null, 2)}
                            </pre>
                        </div>
                        {/* Response Body Viewer */
                        }
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {isJson && (
                                        <button
                                            onClick={() => setActiveTab('tree')}
                                            className={`px-2 py-1 text-xs rounded-lg transition-colors ${activeTab === 'tree' ? 'button-glass' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                                            style={activeTab === 'tree' ? { backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' } : { color: 'var(--node-text)' }}
                                            title="JSON Tree"
                                        >
                                            <div className="flex items-center gap-1"><Braces className="w-3 h-3" /><span>Tree</span></div>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setActiveTab('raw')}
                                        className={`px-2 py-1 text-xs rounded-lg transition-colors ${activeTab === 'raw' ? 'button-glass' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                                        style={activeTab === 'raw' ? { backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' } : { color: 'var(--node-text)' }}
                                        title="Raw"
                                    >
                                        <div className="flex items-center gap-1"><Code className="w-3 h-3" /><span>Raw</span></div>
                                    </button>
                                    {isHtml && (
                                        <button
                                            onClick={() => setActiveTab('html')}
                                            className={`px-2 py-1 text-xs rounded-lg transition-colors ${activeTab === 'html' ? 'button-glass' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                                            style={activeTab === 'html' ? { backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' } : { color: 'var(--node-text)' }}
                                            title="HTML"
                                        >
                                            <div className="flex items-center gap-1"><Code className="w-3 h-3" /><span>HTML</span></div>
                                        </button>
                                    )}
                                    {isImage && (
                                        <button
                                            onClick={() => setActiveTab('image')}
                                            className={`px-2 py-1 text-xs rounded-lg transition-colors ${activeTab === 'image' ? 'button-glass' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                                            style={activeTab === 'image' ? { backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' } : { color: 'var(--node-text)' }}
                                            title="Image"
                                        >
                                            <div className="flex items-center gap-1"><ImageIcon className="w-3 h-3" /><span>Image</span></div>
                                        </button>
                                    )}
                                    {isArrayOfObjects && (
                                        <button
                                            onClick={() => setActiveTab('table')}
                                            className={`px-2 py-1 text-xs rounded-lg transition-colors ${activeTab === 'table' ? 'button-glass' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                                            style={activeTab === 'table' ? { backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' } : { color: 'var(--node-text)' }}
                                            title="Table"
                                        >
                                            <div className="flex items-center gap-1"><TableIcon className="w-3 h-3" /><span>Table</span></div>
                                        </button>
                                    )}
                                    {/* Move Copy next to tabs for consistent spacing */}
                                    <button onClick={() => copyText(bodyText)} className="px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1" style={{ color: 'var(--node-text)' }} title="Copy body">
                                        <Copy className="w-3 h-3" /> Copy
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 ml-auto flex-wrap">
                                    {/* View dropdown temporarily hidden for compact toolbar */}
                                    {activeTab === 'raw' && (
                                        <button onClick={() => setWrapRaw(!wrapRaw)} className="px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1" style={{ color: 'var(--node-text)' }}>
                                            <WrapText className="w-3 h-3" /> {wrapRaw ? 'No wrap' : 'Wrap'}
                                        </button>
                                    )}
                                    {/* Search controls */}
                                    <div className="flex items-center gap-1 ml-1">
                                        <div className="flex items-center gap-1 px-2 py-1 rounded-lg min-w-[8rem] max-w-[14rem]" style={{ backgroundColor: 'var(--node-input-bg)', border: '1px solid var(--node-border)' }}>
                                            <Search className="w-3 h-3" style={{ color: 'var(--node-text-muted)' }} />
                                            <input
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search..."
                                                className="bg-transparent text-xs focus:outline-none w-full"
                                                style={{ color: 'var(--node-text)' }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--node-text-muted)' }}>
                                            {matchesCount > 0 ? `${currentMatchIndex + 1}/${matchesCount}` : '0/0'}
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); prevMatch(); }} disabled={matchesCount === 0} className="px-1.5 py-1 text-xs rounded-lg disabled:opacity-50 hover:bg-black/5 dark:hover:bg-white/5">
                                            <ChevronLeft className="w-3 h-3" />
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); nextMatch(); }} disabled={matchesCount === 0} className="px-1.5 py-1 text-xs rounded-lg disabled:opacity-50 hover:bg-black/5 dark:hover:bg-white/5">
                                            <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Tree-specific jump + breadcrumbs */}
                            {activeTab === 'tree' && (
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <div className="flex items-center gap-1 px-2 py-1 rounded-lg flex-1" style={{ backgroundColor: 'var(--node-input-bg)', border: '1px solid var(--node-border)' }}>
                                        <span className="text-[10px]" style={{ color: 'var(--node-text-muted)' }}>$</span>
                                        <input
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = (e.target as HTMLInputElement).value;
                                                    jumpToPath(val);
                                                }
                                            }}
                                            placeholder=".data.items[0].id"
                                            className="bg-transparent text-xs flex-1 focus:outline-none"
                                            style={{ color: 'var(--node-text)' }}
                                        />
                                        <button onClick={(e) => {
                                            const parent = (e.currentTarget.previousSibling as HTMLInputElement);
                                            jumpToPath(parent?.value || '');
                                        }} className="px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--node-text)' }}>Go</button>
                                    </div>
                                    {/* Breadcrumbs */}
                                    <div className="flex items-center gap-1 overflow-x-auto min-w-0">
                                        {breadcrumbParts.map((bp, i) => (
                                            <button key={bp} onClick={() => jumpToPath(bp)} className="text-[11px] px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 whitespace-nowrap" style={{ color: 'var(--node-text)' }}>
                                                {i === 0 ? '$' : bp.replace(/^\$\.?/, '')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Viewer Area */}
                            <div ref={viewerRef} className="rounded-lg overflow-hidden relative" style={{ backgroundColor: 'var(--node-input-bg)', border: '1px solid var(--node-border)' }}>
                                <AnimatePresence mode="wait">
                                    {activeTab === 'tree' && isJson && bodyJson !== undefined && (
                                        <motion.div key="tree" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                                            <div className="overflow-auto py-1" style={{ maxHeight: viewerMaxHeight }}>
                                                <JsonNode value={bodyJson} path="$" depth={0} />
                                            </div>
                                        </motion.div>
                                    )}

                                    {activeTab === 'raw' && (
                                        <motion.pre key="raw" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className={`p-2 text-xs font-mono overflow-auto ${wrapRaw ? 'whitespace-pre-wrap' : 'whitespace-pre'}`} style={{ color: 'var(--node-text)', maxHeight: viewerMaxHeight }}>
                                            {(() => {
                                                if (!searchQuery) return bodyText;
                                                const q = searchQuery;
                                                const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
                                                const parts = bodyText.split(re);
                                                let matchCounter = -1;
                                                return parts.map((part, i) => {
                                                    const isMatch = i % 2 === 1;
                                                    if (!isMatch) return <span key={i}>{part}</span>;
                                                    matchCounter += 1;
                                                    const isCurrent = matchCounter === currentMatchIndex;
                                                    return (
                                                        <span key={i} ref={isCurrent ? (el) => { rawMatchRef.current = el; } : undefined} className={isCurrent ? 'bg-yellow-300/50 rounded px-0.5' : 'bg-yellow-200/30 rounded px-0.5'}>
                                                            {part}
                                                        </span>
                                                    );
                                                });
                                            })()}
                                        </motion.pre>
                                    )}

                                    {activeTab === 'html' && (
                                        <motion.div key="html" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="overflow-auto" style={{ maxHeight: viewerMaxHeight }}>
                                            <div className="flex items-center gap-1 p-2 border-b" style={{ borderColor: 'var(--node-border)' }}>
                                                <button onClick={() => setHtmlViewMode('preview')} className={`px-2 py-1 text-xs rounded-lg ${htmlViewMode === 'preview' ? 'button-glass' : 'hover:bg-black/5 dark:hover:bg-white/5'}`} style={htmlViewMode === 'preview' ? { backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' } : { color: 'var(--node-text)' }}>Preview</button>
                                                <button onClick={() => setHtmlViewMode('source')} className={`px-2 py-1 text-xs rounded-lg ${htmlViewMode === 'source' ? 'button-glass' : 'hover:bg-black/5 dark:hover:bg-white/5'}`} style={htmlViewMode === 'source' ? { backgroundColor: 'var(--button-secondary-bg)', color: 'var(--button-secondary-text)', border: '1px solid var(--node-border)' } : { color: 'var(--node-text)' }}>Source</button>
                                                <a href={response.url} target="_blank" rel="noreferrer" className="ml-auto px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1" style={{ color: 'var(--node-text)' }}>
                                                    <ExternalLink className="w-3 h-3" /> Open
                                                </a>
                                            </div>
                                            {htmlViewMode === 'preview' ? (
                                                <iframe sandbox="" className="w-full" style={{ height: '22rem', background: 'white' }} srcDoc={typeof response.data === 'string' ? response.data : bodyText} />
                                            ) : (
                                                <pre className="p-2 text-xs font-mono overflow-auto whitespace-pre-wrap" style={{ color: 'var(--node-text)', maxHeight: viewerMaxHeight }}>
                                                    {bodyText}
                                                </pre>
                                            )}
                                        </motion.div>
                                    )}

                                    {activeTab === 'image' && (
                                        <motion.div key="image" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="p-2 flex flex-col gap-2 items-center justify-center" style={{ backgroundColor: 'var(--node-input-bg)' }}>
                                            <div className="w-full flex items-center justify-center" style={{ maxHeight: '20rem' }}>
                                                <Image src={response.url} alt="response" width={800} height={600} className="object-contain max-h-80 rounded" unoptimized />
                                            </div>
                                            <a href={response.url} target="_blank" rel="noreferrer" className="px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1" style={{ color: 'var(--node-text)' }}>
                                                <ExternalLink className="w-3 h-3" /> Open original
                                            </a>
                                        </motion.div>
                                    )}

                                    {activeTab === 'table' && isArrayOfObjects && (
                                        <motion.div key="table" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="overflow-auto" style={{ maxHeight: viewerMaxHeight }}>
                                            <div className="p-2 flex items-center gap-2 border-b" style={{ borderColor: 'var(--node-border)' }}>
                                                <div className="text-xs" style={{ color: 'var(--node-text-muted)' }}>Columns:</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {allColumns.map((col) => (
                                                        <label key={col} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--node-text)' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={visibleColumns.includes(col)}
                                                                onChange={(e) => {
                                                                    const checked = e.target.checked;
                                                                    setVisibleColumns((prev) => {
                                                                        const set = new Set(prev);
                                                                        if (checked) set.add(col); else set.delete(col);
                                                                        return Array.from(set);
                                                                    });
                                                                }}
                                                            />
                                                            {col}
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="overflow-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="sticky top-0" style={{ background: 'var(--node-header-bg)' }}>
                                                            {visibleColumns.map((c) => (
                                                                <th key={c} className="text-left px-2 py-1 font-medium" style={{ color: 'var(--node-text)' }}>{c}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(Array.isArray(bodyJson) ? (bodyJson as Array<Record<string, unknown>>) : []).map((row, idx) => (
                                                            <tr key={idx} className="border-t" style={{ borderColor: 'var(--node-border)' }}>
                                                                {visibleColumns.map((c) => (
                                                                    <td key={c} className="px-2 py-1" style={{ color: 'var(--node-text-muted)' }}>
                                                                        {(() => {
                                                                            const v = row?.[c];
                                                                            if (v == null) return '';
                                                                            if (typeof v === 'object') return JSON.stringify(v);
                                                                            return String(v);
                                                                        })()}
                                                                    </td>
                                                                ))}
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Fallback for unknown/binary: suggest download */}
                                    {!isJson && !isHtml && !isImage && activeTab !== 'raw' && (
                                        <motion.div key="fallback" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }} className="p-3 text-xs flex items-center gap-2" style={{ color: 'var(--node-text)' }}>
                                            <Download className="w-3 h-3" />
                                            <span>Binary or unknown format. </span>
                                            <a href={response.url} target="_blank" rel="noreferrer" className="underline">Open</a>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Height resizer handle */}
                                <div
                                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsResizingHeight(true); }}
                                    className="w-full h-2 cursor-ns-resize"
                                    style={{ background: 'transparent' }}
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="text-xs" style={{ color: 'var(--node-text-muted)' }}>Response Preview</div>
                        <div
                            className="rounded-lg p-2 text-xs font-mono max-h-32 overflow-hidden relative"
                            style={{
                                backgroundColor: 'var(--node-input-bg)',
                                color: 'var(--node-text)'
                            }}
                        >
                            {typeof response.data === 'string'
                                ? (response.data || '').slice(0, 240)
                                : JSON.stringify(response.data, null, 2).slice(0, 240)
                            }
                            {(typeof response.data === 'string' ? (response.data || '') : JSON.stringify(response.data)).length > 240 && (
                                <div
                                    className="absolute bottom-0 right-0 bg-gradient-to-l to-transparent w-16 h-8"
                                    style={{
                                        background: `linear-gradient(to left, var(--node-input-bg), transparent)`
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
});

ResponseNode.displayName = 'ResponseNode';

export default ResponseNode;
