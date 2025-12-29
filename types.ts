export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'LIST' | 'RETR' | 'STOR' | 'MONGO_QUERY' | 'SQL_QUERY';

export type BodyType = 'none' | 'json' | 'text' | 'xml' | 'form-data' | 'mongo' | 'sql';

export type AuthType = 'none' | 'basic' | 'bearer' | 'apikey';

export type StorageMode = 'system' | 'cloud';

export interface AuthConfig {
  type: AuthType;
  username?: string;
  password?: string;
  token?: string;
  key?: string;
  value?: string;
  addTo: 'header' | 'query';
}

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
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

export interface VaultSecret {
  id: string;
  key: string;
  value: string;
  type: 'token' | 'secret' | 'key';
  lastRotated: number;
}

export interface Scenario {
  id: string;
  name: string;
  body: string;
  bodyType: BodyType;
  headers: Header[];
  params: Header[]; 
  version: string;
  lastChanged: string;
  pushedBy?: string;
}

export interface RequestConfig {
  id: string;
  url: string;
  method: Method;
  auth?: AuthConfig;
  scenarios: Scenario[];
  activeScenarioIndex: number;
  collectionId?: string;
}

export interface VersionEntry {
  version: string;
  timestamp: number;
  author: string;
  changes: string;
  comment?: string;
  data: any; 
}

export interface HistoryItem extends RequestConfig {
  status: number;
  statusText?: string;
  time: number;
  size?: string;
  timestamp: number;
  response: any;
  type: string;
  querySummary?: string;
  isReadOnly?: boolean;
  isMaster?: boolean;
  ownerId?: string;
  secretKey?: string;
  versionHistory?: VersionEntry[];
}

export interface User {
  id: string;
  email: string;
  username: string;
  password?: string;
  role: 'superadmin' | 'admin' | 'user';
  managedCollections?: string[];
  createdAt: number;
  subscription?: 'free' | 'pro';
}

export interface CollectionGroup {
  id: string;
  name: string;
  host: string;
  requests: HistoryItem[];
  variables: EnvVariable[];
  vault: VaultSecret[];
  version: string;
  ownerId: string;
}

export interface StashItem {
  id: string;
  url: string;
  method: Method;
  scenarios: Scenario[];
  activeScenarioIndex: number;
  timestamp: number;
  name: string;
}
