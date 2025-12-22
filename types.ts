
export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type ProcessingMode = 'client' | 'server';

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestConfig {
  name?: string;
  url: string;
  method: Method;
  headers: Header[];
  body: string;
  bodyType: 'none' | 'json' | 'xml' | 'text' | 'form-data';
  transformationScript: string;
  processingMode: ProcessingMode;
}

export interface ResponseData {
  status: number;
  statusText: string;
  time: number;
  size: string;
  headers: Record<string, string>;
  data: any;
  raw: string;
  type: 'json' | 'xml' | 'text' | 'other';
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  request: RequestConfig;
  responseStatus?: number;
}

export interface EnvVariable {
  key: string;
  value: string;
  enabled: boolean;
}

export interface Environment {
  id: string;
  name: string;
  variables: EnvVariable[];
}

export interface Collection {
  id: string;
  name: string;
  requests: RequestConfig[];
}

export interface User {
  username: string;
  password?: string; // Stored locally for simulation
  activeEnvId?: string;
}
