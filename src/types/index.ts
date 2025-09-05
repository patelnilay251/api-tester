export interface QueryParam {
  key: string;
  value: string;
}

export type Assertion =
  | { id: string; type: 'status'; equals: number }
  | { id: string; type: 'bodyContains'; text: string }
  | { id: string; type: 'headerContains'; header: string; text: string };

export interface RequestData {
  url: string;
  method: string;
  headers: string; // raw string (JSON or key:value lines)
  data: string; // raw string (JSON or text)
  queryParams?: QueryParam[];
  useBearer?: boolean;
  bearerToken?: string;
  assertions?: Assertion[];
}

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  responseTime: number;
  url: string;
  fromCache?: boolean;
}

export interface AssertionResult {
  id: string;
  passed: boolean;
  description: string;
}
