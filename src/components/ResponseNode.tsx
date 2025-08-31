'use client';

import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { motion } from 'framer-motion';
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
        response: {
            status: number;
            statusText: string;
            headers: Record<string, string>;
            data: any;
            responseTime: number;
            url: string;
        };
        requestData: {
            url: string;
            method: string;
            headers: string;
            data: string;
        };
        name?: string;
        onDelete?: (nodeId: string) => void;
        onNameChange?: (nodeId: string, newName: string) => void;
    };
    selected?: boolean;
}

const ResponseNode = memo(({ id, data, selected }: ResponseNodeProps) => {
    const [showDetails, setShowDetails] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const { response, requestData } = data;
    const [currentName, setCurrentName] = useState(data.name || `Response ${response.status}`);

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
            className={`group w-72 bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 ${selected ? 'ring-2 ring-black/20' : ''
                }`}
        >
            <Handle type="target" position={Position.Left} className="w-3 h-3 bg-black/20" />

            {/* Header */}
            <div className="p-4 border-b border-black/10">
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
                                    className="flex-1 px-2 py-1 text-xs font-medium text-black/80 bg-white border border-black/20 rounded focus:outline-none focus:ring-1 focus:ring-black/30"
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
                                <span className="text-xs font-medium text-black/80 truncate" title={currentName}>
                                    {currentName}
                                </span>
                                <button
                                    onClick={handleNameEdit}
                                    className="p-1 hover:bg-black/5 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="Edit name"
                                >
                                    <Edit3 className="w-3 h-3 text-black/60" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="p-1.5 hover:bg-black/5 rounded-lg transition-colors"
                        >
                            {showDetails ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button
                            onClick={handleCopy}
                            className="p-1.5 hover:bg-black/5 rounded-lg transition-colors"
                        >
                            <Copy className="w-3 h-3 text-black/60" />
                        </button>
                        {data.onDelete && (
                            <button
                                onClick={() => data.onDelete?.(id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete this response node"
                            >
                                <X className="w-3 h-3 text-red-500" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Method and URL Row */}
                <div className="flex items-center gap-2 text-xs text-black/40 mb-2">
                    <span className="font-mono">{requestData.method}</span>
                    <span className="truncate">
                        {new URL(requestData.url).pathname}
                    </span>
                </div>

                {/* Status and Time */}
                <div className="flex justify-between items-center">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor()}`}>
                        {getStatusIcon()}
                        {response.status} {response.statusText}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-black/60">
                        <Clock className="w-3 h-3" />
                        {response.responseTime}ms
                    </div>
                </div>
            </div>

            {/* Response Preview */}
            <div className="p-4">
                {showDetails ? (
                    <div className="space-y-3">
                        {/* Response Headers */}
                        <div>
                            <h4 className="text-xs font-medium text-black/60 mb-1">Headers</h4>
                            <pre className="bg-black/5 rounded-lg p-2 text-xs font-mono text-black/70 overflow-x-auto max-h-20 overflow-y-auto">
                                {JSON.stringify(response.headers, null, 2)}
                            </pre>
                        </div>

                        {/* Response Body */}
                        <div>
                            <h4 className="text-xs font-medium text-black/60 mb-1">Response Body</h4>
                            <pre className="bg-black/5 rounded-lg p-2 text-xs font-mono text-black/70 overflow-x-auto max-h-32 overflow-y-auto">
                                {typeof response.data === 'string'
                                    ? response.data
                                    : JSON.stringify(response.data, null, 2)
                                }
                            </pre>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <div className="text-xs text-black/60">Response Preview</div>
                        <div className="bg-black/5 rounded-lg p-2 text-xs font-mono text-black/70 max-h-16 overflow-hidden relative">
                            {typeof response.data === 'string'
                                ? response.data.slice(0, 100)
                                : JSON.stringify(response.data, null, 2).slice(0, 100)
                            }
                            {(typeof response.data === 'string' ? response.data : JSON.stringify(response.data)).length > 100 && (
                                <div className="absolute bottom-0 right-0 bg-gradient-to-l from-black/5 to-transparent w-8 h-4" />
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
