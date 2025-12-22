
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
  { id: 'javascript', name: 'JavaScript (Fetch)' },
  { id: 'python', name: 'Python (Requests)' },
  { id: 'go', name: 'Go (Native)' },
  { id: 'java', name: 'Java (OkHttp)' }
];
