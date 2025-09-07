export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface CanvasPosition {
  x?: number;
  y?: number;
}

// Minimal summary of a request/response for context
export interface NodeRequestSummary {
  url?: string;
  method?: HttpMethod | string;
  headersPreview?: Record<string, string>;
  bodyPreview?: string;
}

export interface NodeResponseSummary {
  status?: number;
  responseTime?: number;
  fromCache?: boolean;
}

export interface SelectedNodeSummary {
  id: string;
  type: 'apiRequest' | 'response' | string;
  name?: string;
  lastRequest?: NodeRequestSummary;
  lastResponse?: NodeResponseSummary;
}

export interface CanvasContextPayload {
  selectedNodes: SelectedNodeSummary[];
  edges: Array<{ id: string; source: string; target: string }>;
}

// Action vocabulary the agent can propose
export type CanvasAction =
  | {
      type: 'create_request_node';
      name?: string;
      position?: CanvasPosition;
      request?: {
        url?: string;
        method?: HttpMethod | string;
        headers?: Record<string, string> | string;
        body?: unknown;
        queryParams?: Array<{ key: string; value: string }>;
      };
    }
  | {
      type: 'update_request';
      nodeId?: string;
      nodeName?: string;
      patch: {
        url?: string;
        method?: HttpMethod | string;
        headers?: Record<string, string> | string;
        body?: unknown;
        queryParams?: Array<{ key: string; value: string }>;
        useBearer?: boolean;
        bearerToken?: string;
      };
    }
  | {
      type: 'send_request';
      nodeId?: string;
      nodeName?: string;
      // Optional one-shot overrides to apply before sending
      patch?: {
        url?: string;
        method?: HttpMethod | string;
        headers?: Record<string, string> | string;
        body?: unknown;
        queryParams?: Array<{ key: string; value: string }>;
        useBearer?: boolean;
        bearerToken?: string;
      };
    }
  | {
      type: 'connect_nodes';
      sourceId?: string;
      targetId?: string;
      sourceName?: string;
      targetName?: string;
    }
  | {
      type: 'rename_node';
      nodeId?: string;
      nodeName?: string;
      name: string;
    }
  | {
      type: 'delete_node';
      nodeId?: string;
      nodeName?: string;
    }
  | {
      type: 'add_assertion';
      nodeId?: string;
      nodeName?: string;
      assertion: { type: 'status'; equals: number } | { type: 'bodyContains'; text: string } | { type: 'headerContains'; header: string; text: string };
    }
  | {
      type: 'remove_assertion';
      nodeId?: string;
      nodeName?: string;
      assertionId?: string; // if known
      match?: { type: 'status' | 'bodyContains' | 'headerContains' };
    };

export function isCanvasAction(v: unknown): v is CanvasAction {
  return !!v && typeof v === 'object' && 'type' in (v as Record<string, unknown>);
}
