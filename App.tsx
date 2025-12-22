
import React, { useState, useEffect, useCallback } from 'react';
import { Method, RequestConfig, ResponseData, HistoryItem } from './types';
import { INITIAL_REQUEST, LANGUAGES } from './constants';
import { Editor } from './components/Editor';
import { DataTable } from './components/DataTable';
import { JsonOps } from './components/JsonOps';
import { DeploymentModal } from './components/DeploymentModal';
import { generateLocalCode } from './utils/codeGenerator';

const App: React.FC = () => {
  // Persistence logic: Load from localStorage
  const loadSavedConfig = () => {
    const saved = localStorage.getItem('nova_last_config');
    return saved ? JSON.parse(saved) : INITIAL_REQUEST;
  };

  const loadHistory = () => {
    const saved = localStorage.getItem('nova_history');
    return saved ? JSON.parse(saved) : [];
  };

  const [config, setConfig] = useState<RequestConfig>(loadSavedConfig());
  const [originalResponse, setOriginalResponse] = useState<ResponseData | null>(null);
  const [processedData, setProcessedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'script'>('headers');
  const [respTab, setRespTab] = useState<'body' | 'table' | 'headers' | 'code'>('body');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [generatedCode, setGeneratedCode] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(loadHistory());
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const [currentActionCode, setCurrentActionCode] = useState<string>('');
  const [showDeployment, setShowDeployment] = useState(false);
  
  // Extension detection
  const isExtension = !!((window as any).chrome && (window as any).chrome.runtime && (window as any).chrome.runtime.id) || !!(window as any).acquireVsCodeApi;
  const [isCompact, setIsCompact] = useState(window.innerWidth < 500);

  useEffect(() => {
    const handleResize = () => setIsCompact(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync state to storage
  useEffect(() => {
    localStorage.setItem('nova_last_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('nova_history', JSON.stringify(history));
  }, [history]);

  const prettyJson = (obj: any) => {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  };

  const applyTransformation = (data: any, script: string) => {
    try {
      const transform = new Function('data', script);
      return transform(data);
    } catch (e: any) {
      console.error('Script Error:', e);
      return { error: 'Transformation Error', message: e.message };
    }
  };

  const handleSend = async () => {
    setLoading(true);
    setOriginalResponse(null);
    setProcessedData(null);
    setCurrentActionCode('');
    const startTime = performance.now();

    try {
      const headersObj: Record<string, string> = {};
      config.headers.forEach(h => {
        if (h.enabled && h.key) headersObj[h.key] = h.value;
      });

      const options: RequestInit = {
        method: config.method,
        headers: headersObj,
      };

      if (config.method !== 'GET' && config.method !== 'HEAD' && config.body) {
        options.body = config.body;
      }

      const res = await fetch(config.url, options);
      const endTime = performance.now();
      const contentType = res.headers.get('content-type') || '';
      const rawText = await res.text();
      
      let data: any = rawText;
      let type: 'json' | 'xml' | 'text' | 'other' = 'text';

      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(rawText);
          type = 'json';
        } catch (e) {}
      } else if (contentType.includes('xml')) {
        type = 'xml';
      }

      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => (resHeaders[k] = v));

      const responseData: ResponseData = {
        status: res.status,
        statusText: res.statusText,
        time: Math.round(endTime - startTime),
        size: (rawText.length / 1024).toFixed(2) + ' KB',
        headers: resHeaders,
        data,
        raw: rawText,
        type
      };

      setOriginalResponse(responseData);
      
      let finalData = data;
      if (type === 'json' && config.transformationScript) {
        finalData = applyTransformation(data, config.transformationScript);
      }
      setProcessedData(finalData);
      
      const newHistory: HistoryItem = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        request: { ...config },
        responseStatus: res.status
      };
      setHistory(prev => [newHistory, ...prev].slice(0, 50));

      if (Array.isArray(finalData)) setRespTab('table');
      else setRespTab('body');

    } catch (err: any) {
      const endTime = performance.now();
      const errRes = {
        status: 0,
        statusText: 'Error',
        time: Math.round(endTime - startTime),
        size: '0 KB',
        headers: {},
        data: { error: err.message || 'Failed to fetch' },
        raw: err.message,
        type: 'json' as const
      };
      setOriginalResponse(errRes);
      setProcessedData(errRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (respTab === 'code') {
      const code = generateLocalCode(config, codeLanguage);
      setGeneratedCode(code);
    }
  }, [respTab, codeLanguage, config]);

  const appendToScript = () => {
    if (!currentActionCode) return;
    const cleanAction = currentActionCode.startsWith('data.') 
      ? `data = ${currentActionCode};`
      : `data = ${currentActionCode.replace('data', 'data')};`;
      
    const newScript = `${config.transformationScript}\n\n// UI Generated Action:\n${cleanAction}\nreturn data;`.replace('return data;\nreturn data;', 'return data;');
    setConfig({ ...config, transformationScript: newScript });
    setActiveTab('script');
  };

  const handleServerSideAction = useCallback((filters: Record<string, string>, sort: { key: string; order: string } | null) => {
    let currentBodyObj: any = {};
    try {
      if (config.body) {
        currentBodyObj = JSON.parse(config.body);
      }
    } catch (e) {
      currentBodyObj = { original: config.body };
    }

    const updatedBody = {
      ...currentBodyObj,
      filters: filters,
      sort: sort
    };

    setConfig(prev => ({ 
      ...prev, 
      body: JSON.stringify(updatedBody, null, 2),
      bodyType: 'json'
    }));
  }, [config.body]);

  const handleResponseEdit = (val: string) => {
    try {
      const parsed = JSON.parse(val);
      setProcessedData(parsed);
    } catch (e) {}
  };

  const openFullPage = () => {
    const chrome = (window as any).chrome;
    if (chrome && chrome.tabs) {
      chrome.tabs.create({ url: 'index.html' });
    } else {
      window.open(window.location.href, '_blank');
    }
  };

  return (
    <div className={`flex flex-col min-h-screen ${isCompact ? 'overflow-y-auto' : 'h-screen overflow-hidden'} bg-slate-950 text-slate-200`}>
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">N</div>
          <h1 className={`font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent ${isCompact ? 'text-sm' : 'text-xl'}`}>NovaAPI</h1>
        </div>
        <div className="flex gap-2 items-center">
          <button 
            onClick={() => setShowDeployment(true)}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-md text-[10px] font-bold text-slate-300 transition-all uppercase"
          >
            <i className="fas fa-rocket text-blue-500"></i>
            {!isCompact && 'Deploy'}
          </button>
          {isExtension && (
            <button 
              onClick={openFullPage} 
              className="p-1.5 text-slate-400 hover:text-white transition-colors"
              title="Open in Full Tab"
            >
              <i className="fas fa-up-right-from-square text-xs"></i>
            </button>
          )}
          <span className="text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded font-mono uppercase font-bold">EXT</span>
        </div>
      </header>

      {showDeployment && (
        <DeploymentModal 
          onClose={() => setShowDeployment(false)} 
          files={{
            'index.html': document.documentElement.outerHTML,
            'index.tsx': '', // Conceptually empty or you'd pass content
            'App.tsx': '',
            'types.ts': '',
            'constants.tsx': '',
            'utils/codeGenerator.ts': ''
            // In a real environment, you'd pass actual file content from a state or virtual FS
          }} 
        />
      )}

      <main className={`flex-1 flex ${isCompact ? 'flex-col' : 'flex-row'} overflow-hidden`}>
        {!isCompact && (
          <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">History</h2>
              <button onClick={() => setHistory([])} className="text-[10px] text-slate-600 hover:text-red-400 transition-colors">Clear</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {history.map(item => (
                <button
                  key={item.id}
                  onClick={() => setConfig(item.request)}
                  className="w-full text-left p-2 rounded hover:bg-slate-800 group transition-colors mb-1 border border-transparent hover:border-slate-700"
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[9px] font-bold px-1 rounded ${item.request.method === 'GET' ? 'text-green-500 bg-green-500/10' : 'text-blue-500 bg-blue-500/10'}`}>
                      {item.request.method}
                    </span>
                    <span className={`text-[9px] font-bold ${item.responseStatus && item.responseStatus < 300 ? 'text-green-500' : 'text-red-500'}`}>
                      {item.responseStatus || 'ERR'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate mt-1">{item.request.url}</div>
                </button>
              ))}
            </div>
          </aside>
        )}

        <div className={`flex-1 flex ${isCompact ? 'flex-col' : 'flex-row'} overflow-hidden`}>
          <section className={`flex flex-col border-slate-800 ${isCompact ? 'w-full' : 'w-1/2 border-r'}`}>
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex flex-col gap-2">
              <div className="flex gap-2">
                <select 
                  value={config.method}
                  onChange={(e) => setConfig({ ...config, method: e.target.value as Method })}
                  className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-xs font-bold text-blue-400 outline-none"
                >
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type="text"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="URL..."
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={loading}
                className="w-full py-2 rounded-md font-bold text-xs bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-700 flex items-center justify-center gap-2"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                SEND REQUEST
              </button>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex bg-slate-900 border-b border-slate-800 overflow-x-auto no-scrollbar">
                {(['params', 'headers', 'body', 'script'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
                      activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {activeTab === 'headers' && (
                  <div className="space-y-2">
                    {config.headers.map((h, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="text" value={h.key} placeholder="Header" onChange={(e) => {
                          const h2 = [...config.headers]; h2[i].key = e.target.value; setConfig({...config, headers: h2});
                        }} className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 outline-none" />
                        <input type="text" value={h.value} placeholder="Value" onChange={(e) => {
                          const h2 = [...config.headers]; h2[i].value = e.target.value; setConfig({...config, headers: h2});
                        }} className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 outline-none" />
                      </div>
                    ))}
                    <button onClick={() => setConfig({...config, headers: [...config.headers, {key: '', value: '', enabled: true}]})} className="text-[10px] text-blue-500 mt-2 font-bold uppercase">+ Add Header</button>
                  </div>
                )}
                {activeTab === 'body' && <div className="h-full min-h-[200px]"><Editor value={config.body} onChange={(v) => setConfig({...config, body: v})} /></div>}
                {activeTab === 'script' && <div className="h-full min-h-[200px]"><Editor value={config.transformationScript} onChange={(v) => setConfig({...config, transformationScript: v})} /></div>}
              </div>
            </div>
          </section>

          <section className={`flex flex-col bg-slate-950 ${isCompact ? 'w-full' : 'w-1/2'}`}>
             <div className="p-3 bg-slate-900 border-b border-slate-800 flex justify-between items-center h-[52px]">
               <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Response</h3>
               {originalResponse && (
                 <div className="flex items-center gap-2">
                   <span className="text-[9px] text-slate-500">{originalResponse.status} OK • {originalResponse.time}ms</span>
                   <button onClick={() => setIsEditingResponse(!isEditingResponse)} className={`text-[10px] p-1.5 rounded ${isEditingResponse ? 'bg-blue-600' : 'bg-slate-800'}`}>
                     <i className="fas fa-pencil-alt"></i>
                   </button>
                 </div>
               )}
             </div>

             <div className="flex-1 flex flex-col overflow-hidden">
               {originalResponse ? (
                 <>
                   <div className="flex bg-slate-900 border-b border-slate-800 overflow-x-auto no-scrollbar">
                     {(['body', 'table', 'code'] as const).map(tab => (
                       <button
                         key={tab}
                         onClick={() => setRespTab(tab)}
                         className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all shrink-0 ${
                           respTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                         }`}
                       >
                         {tab}
                       </button>
                     ))}
                   </div>
                   <div className="flex-1 overflow-y-auto p-3">
                     {respTab === 'body' && (
                       <div className="h-full flex flex-col gap-2">
                         {originalResponse.type === 'json' && (
                           <JsonOps data={processedData} onDataChange={setProcessedData} onActionGenerated={setCurrentActionCode} />
                         )}
                         {currentActionCode && (
                           <div className="bg-blue-600/10 border border-blue-600/30 p-2 rounded flex justify-between items-center mb-2 animate-in slide-in-from-top-2">
                             <code className="text-[9px] text-blue-300 truncate font-mono flex-1">{currentActionCode}</code>
                             <button onClick={appendToScript} className="text-[9px] font-bold bg-blue-600 text-white px-2 py-1 rounded ml-2">APPLY</button>
                           </div>
                         )}
                         <div className="flex-1 min-h-[300px]">
                           <Editor value={prettyJson(processedData)} onChange={handleResponseEdit} readOnly={!isEditingResponse} />
                         </div>
                       </div>
                     )}
                     {respTab === 'table' && <DataTable data={processedData} onActionGenerated={setCurrentActionCode} mode={config.processingMode} onModeChange={(m) => setConfig({...config, processingMode: m})} onServerSideAction={handleServerSideAction} />}
                     {respTab === 'code' && (
                       <div className="h-full flex flex-col gap-2">
                         <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                           {LANGUAGES.map(l => (
                             <button key={l.id} onClick={() => setCodeLanguage(l.id)} className={`px-2 py-0.5 text-[8px] font-bold rounded-full border ${codeLanguage === l.id ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700'}`}>
                               {l.name}
                             </button>
                           ))}
                         </div>
                         <Editor value={generatedCode} onChange={() => {}} readOnly />
                       </div>
                     )}
                   </div>
                 </>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center text-slate-800 opacity-50 p-8">
                   <i className="fas fa-terminal text-4xl mb-4"></i>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-center">Ready for Execution</p>
                 </div>
               )}
             </div>
          </section>
        </div>
      </main>

      <footer className="bg-slate-900 border-t border-slate-800 px-4 py-1.5 flex justify-between items-center text-[9px] text-slate-600 font-mono shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> LIVE</span>
          {isCompact && <span className="text-blue-500 uppercase font-black">Compact View</span>}
        </div>
        <span>SECURE HANDSHAKE</span>
      </footer>
    </div>
  );
};

export default App;
