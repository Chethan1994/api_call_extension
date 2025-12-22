import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';

// --- Types & Constants ---
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
type ResponseTab = 'pretty' | 'table' | 'transform' | 'headers' | 'raw';

interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

interface HistoryItem {
  id: string;
  url: string;
  method: Method;
  status: number;
  statusText: string;
  time: number;
  size: string;
  timestamp: number;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  body: string;
  response: any;
  type: string;
}

const METHODS: Method[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

// --- Helper Functions ---

const formatJSON = (json: any) => {
  try {
    return JSON.stringify(json, null, 2);
  } catch {
    return String(json);
  }
};

const soapEnvelope = (body: string) => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;

// --- Components ---

const Editor = ({ value, onChange, placeholder, readOnly = false, className = "" }: any) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    readOnly={readOnly}
    placeholder={placeholder}
    className={`w-full h-full font-mono text-xs p-4 bg-slate-900/50 text-blue-300 outline-none resize-none border border-slate-800 rounded-lg focus:border-blue-500/50 transition-colors ${className}`}
    spellCheck={false}
  />
);

const DataTable = ({ data }: { data: any[] }) => {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 opacity-50">
        <i className="fas fa-table text-4xl mb-4"></i>
        <p className="text-xs font-bold uppercase tracking-widest">No tabular data found in response</p>
      </div>
    );
  }

  // Get headers from first 10 items to ensure consistency
  const allHeaders = Array.from(new Set(data.slice(0, 10).flatMap(obj => Object.keys(obj || {}))));
  const displayHeaders = allHeaders.filter(h => typeof data[0][h] !== 'object' && h !== 'id');

  return (
    <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-900/20">
      <table className="w-full text-left text-[11px] border-collapse">
        <thead className="bg-slate-800/80 sticky top-0 z-10 shadow-lg">
          <tr>
            <th className="px-4 py-3 text-slate-500 font-black uppercase tracking-tighter w-12 border-b border-slate-700">#</th>
            {displayHeaders.map(h => (
              <th key={h} className="px-4 py-3 text-slate-300 font-black uppercase tracking-tighter border-b border-slate-700 min-w-[120px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 100).map((row, i) => (
            <tr key={i} className="hover:bg-blue-500/5 transition-colors group">
              <td className="px-4 py-2 border-b border-slate-800/50 text-slate-600 font-mono text-[10px]">{i + 1}</td>
              {displayHeaders.map(h => (
                <td key={h} className="px-4 py-2 border-b border-slate-800/50 text-slate-400 group-hover:text-slate-200 truncate max-w-[250px]" title={String(row[h])}>
                  {String(row[h] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length > 100 && (
        <div className="p-3 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest bg-slate-900/40">
          Showing first 100 of {data.length} records
        </div>
      )}
    </div>
  );
};

// --- Main App ---

const App = () => {
  // Request
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/posts');
  const [method, setMethod] = useState<Method>('GET');
  const [reqBody, setReqBody] = useState('{}');
  const [reqHeaders, setReqHeaders] = useState<Header[]>([
    { key: 'Content-Type', value: 'application/json', enabled: true }
  ]);
  const [isSoap, setIsSoap] = useState(false);

  // Response & Navigation
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('nova_history_v4') || '[]');
    } catch { return []; }
  });
  const [activeItem, setActiveItem] = useState<HistoryItem | null>(null);
  const [respTab, setRespTab] = useState<ResponseTab>('pretty');

  // Advanced Features
  const [searchTerm, setSearchTerm] = useState('');
  const [transformCode, setTransformCode] = useState('(data) => {\n  // Return the data as-is or transform it\n  // Example: return data.filter(item => item.id < 5);\n  return data;\n}');
  const [transformResult, setTransformResult] = useState<any>(null);

  useEffect(() => {
    localStorage.setItem('nova_history_v4', JSON.stringify(history));
  }, [history]);

  const addHeader = () => setReqHeaders([...reqHeaders, { key: '', value: '', enabled: true }]);
  const updateHeader = (i: number, field: keyof Header, val: any) => {
    const copy = [...reqHeaders];
    (copy[i] as any)[field] = val;
    setReqHeaders(copy);
  };
  const removeHeader = (i: number) => setReqHeaders(reqHeaders.filter((_, idx) => idx !== i));

  const executeRequest = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const headersObj: Record<string, string> = {};
      reqHeaders.forEach(h => { if (h.enabled && h.key) headersObj[h.key] = h.value; });

      if (isSoap) {
        headersObj['Content-Type'] = 'text/xml; charset=utf-8';
        if (!headersObj['SOAPAction']) headersObj['SOAPAction'] = '""';
      }

      const fetchUrl = url.startsWith('http') ? url : `https://${url}`;
      const payload = isSoap ? soapEnvelope(reqBody) : reqBody;

      const response = await fetch(fetchUrl, {
        method,
        headers: headersObj,
        body: ['GET', 'HEAD'].includes(method) ? null : payload
      });

      const end = performance.now();
      const rawText = await response.text();
      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = rawText;
      }

      const resHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => resHeaders[k] = v);

      const newItem: HistoryItem = {
        id: crypto.randomUUID(),
        url: fetchUrl,
        method,
        status: response.status,
        statusText: response.statusText,
        time: Math.round(end - start),
        size: (rawText.length / 1024).toFixed(2) + ' KB',
        timestamp: Date.now(),
        requestHeaders: headersObj,
        responseHeaders: resHeaders,
        body: reqBody,
        response: parsed,
        type: response.headers.get('content-type') || 'text/plain'
      };

      setHistory(prev => [newItem, ...prev].slice(0, 50));
      setActiveItem(newItem);
      setTransformResult(null);
      
      if (Array.isArray(parsed)) setRespTab('table');
      else setRespTab('pretty');

    } catch (err: any) {
      alert(`Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Transformation Engine
  useEffect(() => {
    if (!activeItem || respTab !== 'transform') return;
    try {
      const fn = new Function('return ' + transformCode)();
      setTransformResult(fn(activeItem.response));
    } catch (e) {
      // Quietly fail while user types
    }
  }, [transformCode, activeItem, respTab]);

  const displayData = useMemo(() => {
    let base = transformResult !== null ? transformResult : (activeItem?.response || null);
    if (!searchTerm || !base) return base;
    
    const term = searchTerm.toLowerCase();
    if (Array.isArray(base)) {
      return base.filter(item => JSON.stringify(item).toLowerCase().includes(term));
    }
    return base;
  }, [activeItem, transformResult, searchTerm]);

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-200 overflow-hidden font-sans">
      {/* Top Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#1e293b]/50 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white shadow-xl shadow-blue-500/20 rotate-3 transition-transform hover:rotate-0 cursor-default">N</div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white uppercase opacity-90">NovaAPI Studio</h1>
            <p className="text-[10px] text-slate-500 font-mono font-bold tracking-widest uppercase opacity-60">Professional Workspace</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-2">
             <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse-subtle shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Local Link Stable</span>
          </div>
          <button className="text-slate-500 hover:text-white transition-colors text-sm"><i className="fas fa-cog"></i></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: History & Collections */}
        <aside className="w-72 border-r border-slate-800 flex flex-col bg-slate-900/10">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/30">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Call Log</h2>
            <button onClick={() => setHistory([])} className="text-[10px] text-slate-600 hover:text-red-400 font-black uppercase transition-colors">Wipe</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {history.length === 0 ? (
              <div className="p-8 text-center text-slate-700 italic text-xs">Waiting for outbound calls...</div>
            ) : (
              history.map(item => (
                <button 
                  key={item.id} 
                  onClick={() => setActiveItem(item)}
                  className={`w-full text-left p-3 rounded-xl transition-all border ${
                    activeItem?.id === item.id 
                      ? 'bg-blue-600/10 border-blue-500/40 shadow-inner' 
                      : 'border-transparent hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                      item.method === 'GET' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>{item.method}</span>
                    <span className={`text-[9px] font-black ${item.status < 300 ? 'text-green-500' : 'text-red-500'}`}>{item.status}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 truncate opacity-70">{item.url}</div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#0f172a]">
          {/* URL Input Bar */}
          <div className="p-6 bg-slate-900/10 border-b border-slate-800 shadow-2xl z-20">
            <div className="flex gap-3 max-w-6xl mx-auto">
              <select 
                value={method}
                onChange={(e) => setMethod(e.target.value as Method)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-xs font-black outline-none text-blue-400 focus:border-blue-500 transition-all cursor-pointer shadow-inner"
              >
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="flex-1 relative group">
                 <input 
                  type="text" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://api.v3.service.io/resource"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-5 py-3 text-xs font-mono outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all shadow-inner"
                />
                <button 
                  onClick={() => setIsSoap(!isSoap)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest transition-all ${isSoap ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-700 text-slate-500 hover:text-slate-300'}`}
                >
                  SOAP
                </button>
              </div>
              <button 
                onClick={executeRequest}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-3"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                Send
              </button>
            </div>

            {/* Request Setup Tabs */}
            <div className="max-w-6xl mx-auto mt-6">
              <div className="grid grid-cols-2 gap-8 h-44">
                <div className="flex flex-col gap-2 overflow-hidden">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Headers</span>
                    <button onClick={addHeader} className="text-blue-500 text-[10px] font-black uppercase hover:underline">+ New Key</button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                    {reqHeaders.map((h, i) => (
                      <div key={i} className="flex gap-2 items-center group">
                        <input 
                          type="checkbox" 
                          checked={h.enabled} 
                          onChange={(e) => updateHeader(i, 'enabled', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-800 accent-blue-600" 
                        />
                        <input 
                          placeholder="Key" 
                          value={h.key} 
                          onChange={(e) => updateHeader(i, 'key', e.target.value)}
                          className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] flex-1 font-mono outline-none focus:border-blue-500/50" 
                        />
                        <input 
                          placeholder="Value" 
                          value={h.value} 
                          onChange={(e) => updateHeader(i, 'value', e.target.value)}
                          className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] flex-1 font-mono outline-none focus:border-blue-500/50" 
                        />
                        <button onClick={() => removeHeader(i)} className="text-slate-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-times"></i></button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{isSoap ? 'XML Body' : 'JSON Payload'}</span>
                  </div>
                  <Editor value={reqBody} onChange={setReqBody} placeholder={isSoap ? '<Request>...</Request>' : '{ "key": "value" }'} />
                </div>
              </div>
            </div>
          </div>

          {/* Response Container */}
          <section className="flex-1 flex flex-col overflow-hidden bg-slate-950/30">
             {activeItem ? (
               <>
                 {/* Response Status Ribbon */}
                 <div className="px-6 py-4 bg-slate-900/60 border-b border-slate-800 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-8">
                       <div className="flex flex-col">
                          <span className={`text-[12px] font-black leading-none ${activeItem.status < 300 ? 'text-green-500' : 'text-red-500'}`}>
                            {activeItem.status} {activeItem.statusText}
                          </span>
                          <span className="text-[9px] text-slate-500 font-black uppercase mt-1 tracking-widest opacity-60">{activeItem.type.split(';')[0]}</span>
                       </div>
                       <div className="h-8 w-px bg-slate-800"></div>
                       <div className="text-[11px] font-mono flex flex-col">
                          <span className="text-blue-500 font-black tracking-widest leading-none uppercase text-[8px] opacity-60 mb-1">Time</span>
                          <span className="text-slate-300 font-bold">{activeItem.time} ms</span>
                       </div>
                       <div className="text-[11px] font-mono flex flex-col">
                          <span className="text-blue-500 font-black tracking-widest leading-none uppercase text-[8px] opacity-60 mb-1">Size</span>
                          <span className="text-slate-300 font-bold">{activeItem.size}</span>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                       <div className="relative">
                          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]"></i>
                          <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Find in data..."
                            className="bg-slate-800/80 border border-slate-700 rounded-full pl-8 pr-4 py-2 text-[10px] font-mono outline-none focus:border-blue-500 w-56 transition-all shadow-inner"
                          />
                       </div>
                       <button className="text-slate-500 hover:text-blue-400 transition-colors"><i className="fas fa-download"></i></button>
                    </div>
                 </div>

                 {/* Response Action Tabs */}
                 <div className="flex border-b border-slate-800 bg-slate-900/30 px-6 shrink-0 no-select relative">
                    {[
                      { id: 'pretty', label: 'Preview', icon: 'fa-eye' },
                      { id: 'table', label: 'Grid View', icon: 'fa-table' },
                      { id: 'transform', label: 'JS Transform', icon: 'fa-bolt' },
                      { id: 'headers', label: 'Headers', icon: 'fa-list-ul' },
                      { id: 'raw', label: 'Source', icon: 'fa-code' },
                    ].map(tab => (
                      <button 
                        key={tab.id}
                        onClick={() => setRespTab(tab.id as any)}
                        className={`px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 transition-all border-b-2 z-10 ${
                          respTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <i className={`fas ${tab.icon} text-[10px] opacity-60`}></i>
                        {tab.label}
                      </button>
                    ))}
                 </div>

                 {/* Main Response Content */}
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {respTab === 'pretty' && (
                      <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 font-mono text-[11px] leading-relaxed shadow-inner">
                        <pre className="text-blue-300/90 overflow-x-auto whitespace-pre-wrap selection:bg-blue-500/30">
                          {formatJSON(displayData)}
                        </pre>
                      </div>
                    )}

                    {respTab === 'table' && (
                       <DataTable data={Array.isArray(displayData) ? displayData : []} />
                    )}

                    {respTab === 'transform' && (
                      <div className="h-full flex flex-col gap-4">
                        <div className="bg-indigo-600/10 border border-indigo-500/20 p-4 rounded-xl flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                             <i className="fas fa-magic"></i>
                           </div>
                           <div>
                             <p className="text-[11px] text-indigo-200 font-black uppercase tracking-widest">Logic Engine</p>
                             <p className="text-[10px] text-indigo-400/80 font-medium">Transform the raw JSON response using standard JavaScript functions.</p>
                           </div>
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                           <div className="flex flex-col gap-2">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Script Editor</span>
                              <Editor value={transformCode} onChange={setTransformCode} className="flex-1" />
                           </div>
                           <div className="flex flex-col gap-2">
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Live Output</span>
                              <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[10px] text-green-400/80 overflow-y-auto custom-scrollbar shadow-inner">
                                <pre>{formatJSON(transformResult)}</pre>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {respTab === 'headers' && (
                      <div className="max-w-4xl space-y-8">
                        <div>
                          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 border-l-4 border-blue-500 pl-3">Response Meta</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(activeItem.responseHeaders).map(([k, v]) => (
                              <div key={k} className="flex flex-col gap-1 p-3 bg-slate-900/40 rounded-xl border border-slate-800/50">
                                <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">{k}</span>
                                <span className="text-[11px] font-mono text-slate-300 break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4 border-l-4 border-slate-700 pl-3">Request Origin</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
                            {Object.entries(activeItem.requestHeaders).map(([k, v]) => (
                              <div key={k} className="flex flex-col gap-1 p-3 bg-slate-900/20 rounded-xl border border-slate-800/50">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{k}</span>
                                <span className="text-[11px] font-mono text-slate-400 break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {respTab === 'raw' && (
                      <div className="bg-slate-900/60 p-6 rounded-2xl font-mono text-[11px] break-all border border-slate-800 text-slate-400 selection:bg-blue-500/20">
                        {typeof activeItem.response === 'string' ? activeItem.response : JSON.stringify(activeItem.response)}
                      </div>
                    )}
                 </div>
               </>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center opacity-10 no-select pointer-events-none">
                  <i className="fas fa-network-wired text-[100px] mb-8"></i>
                  <p className="text-2xl font-black uppercase tracking-[0.6em] text-white">Nova Protocol Ready</p>
                  <p className="text-xs font-black mt-4 tracking-widest text-blue-500 uppercase">Input target URL to establish handshake</p>
               </div>
             )}
          </section>
        </main>
      </div>

      {/* Footer Status Bar */}
      <footer className="px-6 py-2 bg-[#1e293b]/50 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono font-bold text-slate-500 select-none">
        <div className="flex gap-6 items-center">
          <span className="text-blue-500 uppercase tracking-widest font-black">Environment: Default</span>
          <span className="opacity-40">{new Date().toLocaleTimeString()}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hover:text-blue-400 cursor-pointer transition-colors uppercase tracking-widest">Docs</span>
          <span className="w-1.5 h-1.5 bg-slate-800 rounded-full"></span>
          <span className="uppercase tracking-widest opacity-40">NovaTools © 2025</span>
        </div>
      </footer>
    </div>
  );
};

// Root mount with sanity check
const mountRoot = () => {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountRoot);
} else {
  mountRoot();
}
