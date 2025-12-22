
import React, { useState } from 'react';
import { RequestConfig, Method, Header } from '../types';
import { DEFAULT_HEADERS } from '../constants';

interface ImportModalProps {
  onClose: () => void;
  onImport: (config: Partial<RequestConfig>) => void;
  theme?: 'dark' | 'light';
}

export const ImportModal: React.FC<ImportModalProps> = ({ onClose, onImport, theme = 'dark' }) => {
  const [input, setInput] = useState('');
  const isDark = theme === 'dark';

  const parseCurl = (curlString: string): Partial<RequestConfig> => {
    const config: Partial<RequestConfig> = {
      method: 'GET',
      headers: [],
      body: '',
      bodyType: 'none',
    };

    // Clean up string (remove line breaks and backslashes used for line continuation)
    const cleanStr = curlString.replace(/\\\n/g, ' ').trim();
    
    // Extract URL - simplistic approach
    const urlMatch = cleanStr.match(/(?:'|")?(https?:\/\/[^\s'"]+)(?:'|")?/);
    if (urlMatch) config.url = urlMatch[1];

    // Extract Method
    const methodMatch = cleanStr.match(/(?:-X|--request)\s+([A-Z]+)/);
    if (methodMatch) config.method = methodMatch[1] as Method;

    // Extract Headers
    const headerRegex = /(?:-H|--header)\s+["']([^"']+)["']/g;
    let hMatch;
    const extractedHeaders: Header[] = [];
    while ((hMatch = headerRegex.exec(cleanStr)) !== null) {
      const parts = hMatch[1].split(':');
      if (parts.length >= 2) {
        extractedHeaders.push({
          key: parts[0].trim(),
          value: parts.slice(1).join(':').trim(),
          enabled: true,
        });
      }
    }
    if (extractedHeaders.length > 0) config.headers = extractedHeaders;

    // Extract Data/Body
    const dataRegex = /(?:-d|--data|--data-raw|--data-binary)\s+(['"])([\s\S]*?)\1/g;
    let dMatch = dataRegex.exec(cleanStr);
    if (dMatch) {
      config.body = dMatch[2];
      config.method = config.method === 'GET' ? 'POST' : config.method;
      config.bodyType = config.body.startsWith('{') ? 'json' : 'text';
    }

    return config;
  };

  const parseSoap = (soapString: string): Partial<RequestConfig> => {
    // Detect if it's likely a SOAP request (contains Envelope tag)
    if (soapString.includes('Envelope') && soapString.includes('http://schemas.xmlsoap.org/soap/envelope/')) {
      return {
        method: 'POST',
        body: soapString,
        bodyType: 'xml',
        headers: [
          { key: 'Content-Type', value: 'text/xml; charset=utf-8', enabled: true },
          { key: 'SOAPAction', value: '""', enabled: true }
        ]
      };
    }
    return { body: soapString, bodyType: 'xml', method: 'POST' };
  };

  const handleImport = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return;

    let importedConfig: Partial<RequestConfig> = {};

    if (trimmedInput.toLowerCase().startsWith('curl')) {
      importedConfig = parseCurl(trimmedInput);
    } else if (trimmedInput.startsWith('<')) {
      importedConfig = parseSoap(trimmedInput);
    } else {
      // Try to treat as JSON if it looks like one
      try {
        JSON.parse(trimmedInput);
        importedConfig = { body: trimmedInput, bodyType: 'json', method: 'POST' };
      } catch (e) {
        // Default to text body
        importedConfig = { body: trimmedInput, bodyType: 'text' };
      }
    }

    onImport(importedConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slide-in ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <i className="fas fa-file-import text-blue-500 text-lg"></i>
            <h2 className={`text-sm font-bold uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-800'}`}>Import Request</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 transition-colors"><i className="fas fa-times"></i></button>
        </div>
        <div className="p-6">
          <p className={`text-[11px] mb-4 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Paste a <span className="font-bold text-blue-500">cURL command</span>, <span className="font-bold text-blue-500">SOAP XML</span>, or raw payload to automatically configure the request.
          </p>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste curl 'https://api.example.com' -H 'Authorization: ...' or <soap:Envelope>..."
            className={`w-full h-64 font-mono text-xs p-4 outline-none resize-none border rounded-lg transition-all mb-6 ${
              isDark 
                ? 'bg-slate-950 border-slate-800 text-blue-300 focus:border-blue-500' 
                : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-400'
            }`}
          />
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${
                isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg text-xs font-black uppercase tracking-widest shadow-xl transition-all shadow-blue-900/20 active:scale-[0.98]"
            >
              Import Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
