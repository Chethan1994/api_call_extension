
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { generateLocalCode } from './utils/codeGenerator';

// --- Types & Constants ---
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'LIST' | 'RETR' | 'STOR';

// Define the standard REST methods for the dropdown
const METHODS: Method[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

type ResponseTab = 'pretty' | 'table' | 'preview' | 'media' | 'analytics' | 'docs' | 'headers' | 'raw';

interface Header {
  key: string;
  value: string;
  enabled: boolean;
}

interface AnalyticsData {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgLatency: number;
  totalData: number;
  statusCodes: Record<number, number>;
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
  isBinary?: boolean;
  blobUrl?: string;
}

// --- Library Documentation Data ---
const LIBRARY_DB = [
  { 
    name: 'Axios', 
    frameworks: ['React', 'Vue', 'Node.js', 'Angular'], 
    pros: 'Automatic JSON transforms, Request/Response interceptors, Wide browser support.', 
    cons: 'Slightly larger bundle size than native Fetch.',
    bestFor: 'Complex enterprise apps with global auth/logging needs.'
  },
  { 
    name: 'Fetch API', 
    frameworks: ['All (Native)'], 
    pros: 'Zero dependencies, Built-in to browsers, Promises based.', 
    cons: 'Doesn\'t reject on HTTP error codes (404/500), No interceptors.',
    bestFor: 'Simple projects or performance-critical micro-frontends.'
  },
  { 
    name: 'Angular HttpClient', 
    frameworks: ['Angular'], 
    pros: 'Built-in RxJS support, Observables for reactive streaming, Strict typing.', 
    cons: 'High learning curve if unfamiliar with RxJS.',
    bestFor: 'Strictly Angular-based architectures.'
  },
  { 
    name: 'React Query (TanStack)', 
    frameworks: ['React', 'Next.js', 'Solid', 'Vue'], 
    pros: 'Automatic caching, background fetching, state management for server data.', 
    cons: 'Not a fetching library per-se (needs Fetch/Axios beneath it).',
    bestFor: 'Data-heavy SPAs requiring sync and caching.'
  }
];

// --- Components ---

const FilePreviewer = ({ item, theme }: { item: HistoryItem, theme: string }) => {
  const isDark = theme === 'dark';
  if (!item.blobUrl && !item.isBinary) return <div className="p-8 text-center text-slate-400 italic">No media content detected.</div>;

  const isImage = item.type.startsWith('image/');
  const isPdf = item.type === 'application/pdf';

  return (
    <div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'} shadow-xl`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Binary Preview Engine</h3>
        <a href={item.blobUrl} download={`download-${item.id}`} className="text-xs text-slate-500 hover:text-blue-500"><i className="fas fa-download"></i></a>
      </div>
      
      <div className="flex justify-center bg-slate-100 dark:bg-slate-950 rounded-lg p-4 min-h-[300px] items-center overflow-hidden">
        {isImage ? (
          <img src={item.blobUrl} className="max-w-full h-auto shadow-2xl rounded" alt="API Response" />
        ) : isPdf ? (
          <embed src={item.blobUrl} type="application/pdf" width="100%" height="500px" />
        ) : (
          <div className="text-center font-mono text-[10px]">
             <p className="mb-4 text-slate-500 uppercase font-black">Raw Byte Stream</p>
             <div className="grid grid-cols-4 gap-2 opacity-50">
               {Array.from({length: 16}).map((_, i) => <span key={i} className="bg-slate-800 p-1 rounded">0x{Math.floor(Math.random()*256).toString(16).toUpperCase()}</span>)}
             </div>
             <p className="mt-6 text-blue-500 font-bold">MIME: {item.type}</p>
          </div>
        )}
      </div>
    </div>
  );
};

const AnalyticsDashboard = ({ history, theme }: { history: HistoryItem[], theme: string }) => {
  const isDark = theme === 'dark';
  const stats = useMemo(() => {
    const data: AnalyticsData = { totalRequests: history.length, successCount: 0, errorCount: 0, avgLatency: 0, totalData: 0, statusCodes: {} };
    if (history.length === 0) return data;
    
    let latSum = 0;
    history.forEach(h => {
      if (h.status < 400) data.successCount++; else data.errorCount++;
      latSum += h.time;
      data.statusCodes[h.status] = (data.statusCodes[h.status] || 0) + 1;
    });
    data.avgLatency = Math.round(latSum / history.length);
    return data;
  }, [history]);

  return (
    <div className="space-y-6">
       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Avg Latency', value: `${stats.avgLatency}ms`, color: 'text-blue-500', icon: 'fa-bolt' },
            { label: 'Success Rate', value: `${Math.round((stats.successCount/stats.totalRequests)*100 || 0)}%`, color: 'text-green-500', icon: 'fa-check-circle' },
            { label: 'Errors', value: stats.errorCount, color: 'text-red-500', icon: 'fa-exclamation-triangle' },
            { label: 'Total Calls', value: stats.totalRequests, color: 'text-slate-500', icon: 'fa-satellite' }
          ].map((s, i) => (
            <div key={i} className={`p-4 rounded-xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex justify-between items-start">
                <div>
                   <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">{s.label}</p>
                   <p className={`text-xl font-black mt-1 ${s.color}`}>{s.value}</p>
                </div>
                <i className={`fas ${s.icon} opacity-20 text-xl`}></i>
              </div>
            </div>
          ))}
       </div>
       
       <div className={`p-6 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <h3 className="text-[10px] font-black uppercase text-slate-500 mb-4">Response Time Distribution</h3>
          <div className="flex items-end gap-1 h-32">
             {history.slice(0, 20).reverse().map((h, i) => (
               <div key={i} className="flex-1 group relative">
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 text-white text-[8px] p-1 rounded whitespace-nowrap z-50">
                    {h.time}ms
                  </div>
                  <div 
                    className={`rounded-t-sm transition-all hover:opacity-100 opacity-60 ${h.status < 400 ? 'bg-blue-500' : 'bg-red-500'}`} 
                    style={{ height: `${Math.min(h.time / 10, 100)}%` }}
                  ></div>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
};

// --- Main App ---

const App = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('nova_theme') as any) || 'light');
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/posts');
  const [method, setMethod] = useState<Method>('GET');
  const [reqBody, setReqBody] = useState('{}');
  const [reqHeaders, setReqHeaders] = useState<Header[]>([{ key: 'Content-Type', value: 'application/json', enabled: true }]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>(() => JSON.parse(localStorage.getItem('nova_history_v5') || '[]'));
  const [activeItem, setActiveItem] = useState<HistoryItem | null>(null);
  const [respTab, setRespTab] = useState<ResponseTab>('pretty');
  const [customLibQuery, setCustomLibQuery] = useState('');

  const isDark = theme === 'dark';

  useEffect(() => {
    localStorage.setItem('nova_theme', theme);
    document.documentElement.className = theme;
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('nova_history_v5', JSON.stringify(history));
  }, [history]);

  const executeRequest = async () => {
    setLoading(true);
    const start = performance.now();
    const isFtp = url.startsWith('ftp://');

    try {
      if (isFtp) {
        // FTP Protocol Simulation Logic
        await new Promise(r => setTimeout(r, 1500)); // Simulate connection
        const mockItem: HistoryItem = {
          id: crypto.randomUUID(),
          url, method, status: 226, statusText: 'Transfer complete',
          time: Math.round(performance.now() - start),
          size: '12.4 KB', timestamp: Date.now(),
          requestHeaders: { Protocol: 'FTP/1.1' }, responseHeaders: { 'Server-Type': 'Mock-FTP' },
          body: '', response: { message: "FTP file list or retrieve simulated.", files: ["backup.sql", "index.php", "assets/"] },
          type: 'text/plain'
        };
        setHistory(p => [mockItem, ...p]);
        setActiveItem(mockItem);
        return;
      }

      const hObj: Record<string, string> = {};
      reqHeaders.forEach(h => { if (h.enabled && h.key) hObj[h.key] = h.value; });

      const response = await fetch(url, { 
        method: ['GET', 'HEAD'].includes(method) ? 'GET' : method, 
        headers: hObj, 
        body: ['GET', 'HEAD'].includes(method) ? null : reqBody 
      });

      const end = performance.now();
      const contentType = response.headers.get('content-type') || '';
      const isBinary = contentType.includes('image/') || contentType.includes('pdf') || contentType.includes('octet-stream');

      let parsed;
      let blobUrl = '';
      if (isBinary) {
        const blob = await response.blob();
        blobUrl = URL.createObjectURL(blob);
        parsed = `[Binary Data: ${contentType}]`;
      } else {
        const text = await response.text();
        try { parsed = JSON.parse(text); } catch { parsed = text; }
      }

      const resHeaders: Record<string, string> = {};
      response.headers.forEach((v, k) => resHeaders[k] = v);

      const newItem: HistoryItem = {
        id: crypto.randomUUID(), url, method,
        status: response.status, statusText: response.statusText,
        time: Math.round(end - start), size: '?? KB', timestamp: Date.now(),
        requestHeaders: hObj, responseHeaders: resHeaders,
        body: reqBody, response: parsed, type: contentType,
        isBinary, blobUrl
      };

      setHistory(prev => [newItem, ...prev].slice(0, 50));
      setActiveItem(newItem);
      setRespTab(isBinary ? 'media' : 'pretty');
    } catch (err: any) {
      alert(`Network Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans transition-colors duration-200 ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`flex items-center justify-between px-6 py-3 border-b shrink-0 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white shadow-lg rotate-3">N</div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight uppercase">NovaAPI Protocol Suite</h1>
            <p className="text-[9px] font-bold tracking-widest uppercase opacity-60">FTP / REST / SOAP / ANALYTICS</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDark ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-600'}`}>
             <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
           </button>
           <div className="flex items-center gap-3 bg-blue-500/10 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <span className="text-[9px] font-black text-blue-500 uppercase">Live Engine</span>
           </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar History */}
        <aside className={`w-72 border-r flex flex-col ${isDark ? 'bg-slate-900/10 border-slate-800' : 'bg-white border-slate-200'}`}>
           <div className="p-4 border-b flex justify-between items-center opacity-50">
             <span className="text-[10px] font-black uppercase tracking-widest">Telemetry History</span>
             <i className="fas fa-history text-[10px]"></i>
           </div>
           <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {history.map(item => (
                <button 
                  key={item.id} onClick={() => setActiveItem(item)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${activeItem?.id === item.id ? 'bg-indigo-500/10 border-indigo-500/30' : 'border-transparent hover:bg-slate-200/50 dark:hover:bg-slate-800/50'}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${item.url.startsWith('ftp') ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'}`}>{item.method}</span>
                    <span className={`text-[9px] font-bold ${item.status < 400 ? 'text-green-500' : 'text-red-500'}`}>{item.status}</span>
                  </div>
                  <p className="text-[11px] font-mono truncate opacity-60">{item.url}</p>
                </button>
              ))}
           </div>
        </aside>

        {/* Workspace */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Request Input Area */}
          <div className={`p-6 border-b shadow-sm z-20 ${isDark ? 'bg-slate-900/10 border-slate-800' : 'bg-white border-slate-200'}`}>
             <div className="flex gap-3 max-w-5xl mx-auto">
                <select value={method} onChange={(e) => setMethod(e.target.value as Method)} className={`border rounded-xl px-4 py-3 text-xs font-black outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-indigo-400' : 'bg-slate-50 border-slate-200 text-indigo-600'}`}>
                   {METHODS.concat(['LIST', 'RETR', 'STOR']).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input 
                  type="text" value={url} onChange={(e) => setUrl(e.target.value)} 
                  placeholder="https://... or ftp://..."
                  className={`flex-1 border rounded-xl px-5 py-3 text-xs font-mono outline-none focus:ring-4 ${isDark ? 'bg-slate-800 border-slate-700 focus:ring-indigo-500/10' : 'bg-slate-50 border-slate-200 focus:ring-indigo-500/5'}`}
                />
                <button 
                  onClick={executeRequest} disabled={loading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 active:scale-95 flex items-center gap-3 transition-all"
                >
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-satellite-dish"></i>}
                  Execute
                </button>
             </div>
             
             {/* Subtabs for Request */}
             <div className="max-w-5xl mx-auto mt-6 flex gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <button className="border-b-2 border-indigo-500 text-indigo-500 pb-2">Payload & Config</button>
                <button className="pb-2 hover:text-slate-600">Authentication</button>
                <button className="pb-2 hover:text-slate-600">Variable Lab</button>
             </div>
          </div>

          {/* Response Container */}
          <section className="flex-1 flex flex-col overflow-hidden">
             {activeItem ? (
               <>
                 {/* Navigation Tabs */}
                 <div className={`flex border-b px-6 shrink-0 no-select overflow-x-auto no-scrollbar ${isDark ? 'bg-slate-900/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                    {[
                      { id: 'pretty', label: 'Preview', icon: 'fa-eye' },
                      { id: 'media', label: 'Media Lab', icon: 'fa-file-image' },
                      { id: 'analytics', label: 'Insights', icon: 'fa-chart-area' },
                      { id: 'docs', label: 'Library Lab', icon: 'fa-book-open' },
                      { id: 'raw', label: 'Source', icon: 'fa-code' },
                    ].map(tab => (
                      <button 
                        key={tab.id} onClick={() => setRespTab(tab.id as any)}
                        className={`px-6 py-4 text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${respTab === tab.id ? 'border-indigo-500 text-indigo-500' : 'border-transparent text-slate-400'}`}
                      >
                        <i className={`fas ${tab.icon}`}></i> {tab.label}
                      </button>
                    ))}
                 </div>

                 {/* Tab Content */}
                 <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {respTab === 'pretty' && (
                      <div className={`p-6 rounded-2xl border font-mono text-[11px] ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                         <pre className="text-indigo-500/90 whitespace-pre-wrap">{JSON.stringify(activeItem.response, null, 2)}</pre>
                      </div>
                    )}

                    {respTab === 'media' && <FilePreviewer item={activeItem} theme={theme} />}

                    {respTab === 'analytics' && <AnalyticsDashboard history={history} theme={theme} />}

                    {respTab === 'docs' && (
                      <div className="space-y-8">
                         <div className={`p-6 rounded-2xl border ${isDark ? 'bg-blue-900/10 border-blue-500/20' : 'bg-blue-50 border-blue-200'}`}>
                            <h3 className="text-xs font-black uppercase text-blue-600 mb-2">Code Generator & Library Lab</h3>
                            <p className="text-[11px] opacity-70 mb-4 italic">Generate code with the best libraries for your specific framework.</p>
                            <div className="flex gap-2">
                               <input 
                                 type="text" placeholder="Search custom library (e.g. 'Got', 'Ky')..."
                                 value={customLibQuery} onChange={(e) => setCustomLibQuery(e.target.value)}
                                 className={`flex-1 border rounded-lg px-4 py-2 text-xs outline-none ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
                               />
                               <button className="bg-blue-600 text-white px-4 rounded-lg text-[10px] font-black uppercase">Fetch Patterns</button>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {LIBRARY_DB.map(lib => (
                               <div key={lib.name} className={`p-5 rounded-xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                                  <div className="flex justify-between items-start mb-3">
                                     <h4 className="font-black text-indigo-500">{lib.name}</h4>
                                     <div className="flex gap-1">
                                        {lib.frameworks.map(f => <span key={f} className="text-[8px] bg-slate-200 dark:bg-slate-800 px-1 rounded uppercase font-bold">{f}</span>)}
                                     </div>
                                  </div>
                                  <p className="text-[10px] mb-2 leading-relaxed"><span className="font-bold text-green-500">PROS:</span> {lib.pros}</p>
                                  <p className="text-[10px] mb-2 leading-relaxed"><span className="font-bold text-red-500">CONS:</span> {lib.cons}</p>
                                  <div className={`mt-3 p-2 rounded text-[10px] font-bold ${isDark ? 'bg-indigo-500/10 text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                                     BEST FOR: {lib.bestFor}
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    )}

                    {respTab === 'raw' && (
                      <div className="bg-slate-950 p-6 rounded-2xl font-mono text-[10px] text-slate-500 break-all border border-slate-800 shadow-inner">
                        {JSON.stringify(activeItem, null, 2)}
                      </div>
                    )}
                 </div>
               </>
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center opacity-10 pointer-events-none">
                  <i className="fas fa-network-wired text-[100px] mb-8"></i>
                  <p className="text-2xl font-black uppercase tracking-[0.5em]">Protocol Engine Ready</p>
               </div>
             )}
          </section>
        </main>
      </div>

      <footer className={`px-6 py-2 border-t flex justify-between items-center text-[9px] font-bold uppercase tracking-widest opacity-40 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
         <div className="flex gap-4 items-center">
            <span className="text-indigo-500">Handshake: Verified</span>
            <span className="w-1 h-1 bg-slate-500 rounded-full"></span>
            <span>Uptime: 99.9%</span>
         </div>
         <div className="flex gap-4 items-center">
            <span>Powered by NovaCore v5.2</span>
         </div>
      </footer>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
