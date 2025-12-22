
/**
 * Global type definitions for the NovaAPI client.
 */

// Fix: Restore export types to resolve "is not a module" errors in DataTable, ImportModal, etc.
export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type BodyType = 'none' | 'json' | 'text' | 'xml' | 'form-data';

export interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestConfig {
  id: string;
  name: string;
  url: string;
  method: Method;
  headers: Header[];
  body: string;
  bodyType: BodyType;
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

export type UserRole = 'superadmin' | 'user';

export interface User {
  id: string;
  email: string;
  username: string;
  password?: string;
  role: UserRole;
  createdAt: number;
}

export type ProcessingMode = 'client' | 'server';
