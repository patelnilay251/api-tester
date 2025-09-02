'use client';

import { memo, useMemo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
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
    Check
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
    const passFail = useMemo(() => {
        const arr = data.assertionResults || [];
        const passed = arr.filter(r => r.passed).length;
        const failed = arr.length - passed;
        return { passed, failed };
    }, [data.assertionResults]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
    };

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

    return (
        <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`group w-72 glass-themed rounded-3xl ${selected ? 'ring-2' : ''}`}
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
                                className="rounded-lg p-2 text-xs font-mono overflow-x-auto max-h-20 overflow-y-auto"
                                style={{
                                    backgroundColor: 'var(--node-input-bg)',
                                    color: 'var(--node-text)'
                                }}
                            >
                                {JSON.stringify(response.headers, null, 2)}
                            </pre>
                        </div>

                        {/* Response Body */}
                        <div>
                            <h4 className="text-xs font-medium mb-1" style={{ color: 'var(--node-text-muted)' }}>Response Body</h4>
                            <pre
                                className="rounded-lg p-2 text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto"
                                style={{
                                    backgroundColor: 'var(--node-input-bg)',
                                    color: 'var(--node-text)'
                                }}
                            >
                                {typeof response.data === 'string'
                                    ? response.data
                                    : JSON.stringify(response.data, null, 2)
                                }
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="text-xs" style={{ color: 'var(--node-text-muted)' }}>Response Preview</div>
                        <div
                            className="rounded-lg p-2 text-xs font-mono max-h-16 overflow-hidden relative"
                            style={{
                                backgroundColor: 'var(--node-input-bg)',
                                color: 'var(--node-text)'
                            }}
                        >
                            {typeof response.data === 'string'
                                ? (response.data || '').slice(0, 100)
                                : JSON.stringify(response.data, null, 2).slice(0, 100)
                            }
                            {(typeof response.data === 'string' ? (response.data || '') : JSON.stringify(response.data)).length > 100 && (
                                <div
                                    className="absolute bottom-0 right-0 bg-gradient-to-l to-transparent w-8 h-4"
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
