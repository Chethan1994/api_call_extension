
import { Header, RequestConfig } from './types';

export const DEFAULT_HEADERS: Header[] = [
  { key: 'Content-Type', value: 'application/json', enabled: true },
  { key: 'Accept', value: '*/*', enabled: true }
];

export const INITIAL_REQUEST: RequestConfig = {
  url: 'https://jsonplaceholder.typicode.com/posts',
  method: 'GET',
  headers: [...DEFAULT_HEADERS],
  body: '',
  bodyType: 'none',
  transformationScript: '// Write JS to transform "data"\n// Example: return data.slice(0, 5);\nreturn data;',
  processingMode: 'client'
};

export const LANGUAGES = [
  { id: 'curl', name: 'cURL' },
  { id: 'js-fetch', name: 'JS Fetch' },
  { id: 'ts-fetch', name: 'TS Fetch' },
  { id: 'js-axios', name: 'JS Axios' },
  { id: 'ts-axios', name: 'TS Axios' },
  { id: 'node-axios', name: 'Node Axios' },
  { id: 'node-https', name: 'Node HTTPS' },
  { id: 'python-requests', name: 'Python' },
  { id: 'go-native', name: 'Go' },
  { id: 'java-okhttp', name: 'Java' }
];
