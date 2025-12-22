
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Method, RequestConfig, ResponseData, HistoryItem, Environment, Collection, User } from './types';
import { INITIAL_REQUEST, LANGUAGES } from './constants';
import { Editor } from './components/Editor';
import { DataTable } from './components/DataTable';
import { JsonOps } from './components/JsonOps';
import { DeploymentModal } from './components/DeploymentModal';
import { ImportModal } from './components/ImportModal';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { generateLocalCode } from './utils/codeGenerator';

const App: React.FC = () => {
  // Persistence Helpers
  const loadLocal = <T,>(key: string, def: T): T => {
    const s = localStorage.getItem(key);
    if (s === null) return def;
    try {
      return JSON.parse(s);
    } catch (e) {
      // Fallback for raw strings previously saved without JSON.stringify
      return s as unknown as T;
    }
  };

  // State Management
  const [config, setConfig] = useState<RequestConfig>(loadLocal('nova_last_config', INITIAL_REQUEST));
  const [originalResponse, setOriginalResponse] = useState<ResponseData | null>(null);
  const [processedData, setProcessedData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body' | 'script'>('headers');
  const [respTab, setRespTab] = useState<'body' | 'table' | 'headers' | 'code'>('body');
  const [sidebarTab, setSidebarTab] = useState<'history' | 'collections'>('history');
  
  const [codeLanguage, setCodeLanguage] = useState('js-fetch');
  const [generatedCode, setGeneratedCode] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>(loadLocal('nova_history', []));
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  const [currentActionCode, setCurrentActionCode] = useState<string>('');
  
  // Modals
  const [showDeployment, setShowDeployment] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // New Domain State (Local Storage)
  const [environments, setEnvironments] = useState<Environment[]>(loadLocal('nova_envs', []));
  const [activeEnvId, setActiveEnvId] = useState<string | null>(loadLocal('nova_active_env_id', null));
  const [collections, setCollections] = useState<Collection[]>(loadLocal('nova_collections', []));
  const [user, setUser] = useState<User | null>(loadLocal('nova_user', null));
  
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(loadLocal('nova_theme', 'dark'));
  const isDark = theme === 'dark';

  // Helpers
  const activeEnv = useMemo(() => environments.find(e => e.id === activeEnvId), [environments, activeEnvId]);
  const isExtension = !!((window as any).chrome && (window as any).chrome.runtime && (window as any).chrome.runtime.id) || !!(window as any).acquireVsCodeApi;
  const [isCompact, setIsCompact] = useState(window.innerWidth < 500);

  useEffect(() => {
    const handleResize = () => setIsCompact(window.innerWidth < 500);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persistence Sync
  useEffect(() => localStorage.setItem('nova_last_config', JSON.stringify(config)), [config]);
  useEffect(() => localStorage.setItem('nova_history', JSON.stringify(history)), [history]);
  useEffect(() => localStorage.setItem('nova_envs', JSON.stringify(environments)), [environments]);
  useEffect(() => localStorage.setItem('nova_active_env_id', JSON.stringify(activeEnvId)), [activeEnvId]);
  useEffect(() => localStorage.setItem('nova_collections', JSON.stringify(collections)), [collections]);
  useEffect(() => localStorage.setItem('nova_user', JSON.stringify(user)), [user]);
  useEffect(() => {
    localStorage.setItem('nova_theme', JSON.stringify(theme));
    document.body.style.backgroundColor = isDark ? '#0f172a' : '#f8fafc';
  }, [theme, isDark]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Variable Interpolation Logic
  const interpolate = (text: string) => {
    if (!activeEnv) return text;
    let interpolated = text;
    activeEnv.variables.forEach(v => {
      if (v.enabled && v.key) {
        const regex = new RegExp(`{{${v.key}}}`, 'g');
        interpolated = interpolated.replace(regex, v.value);
      }
    });
    return interpolated;
  };

  const handleSend = async () => {
    setLoading(true);
    setOriginalResponse(null);
    setProcessedData(null);
    setCurrentActionCode('');
    const startTime = performance.now();

    try {
      // Interpolate all inputs
      const interpolatedUrl = interpolate(config.url);
      const interpolatedBody = interpolate(config.body);

      const headersObj: Record<string, string> = {};
      config.headers.forEach(h => {
        if (h.enabled && h.key) {
          headersObj[interpolate(h.key)] = interpolate(h.value);
        }
      });

      const options: RequestInit = {
        method: config.method,
        headers: headersObj,
      };

      if (config.method !== 'GET' && config.method !== 'HEAD' && interpolatedBody) {
        options.body = interpolatedBody;
      }

      const res = await fetch(interpolatedUrl, options);
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
        try {
          const transform = new Function('data', config.transformationScript);
          finalData = transform(data);
        } catch (e) {}
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

  const saveToCollection = () => {
    const name = prompt('Request Name:', config.name || 'Untitled Request');
    if (!name) return;

    let targetCollectionId = collections[0]?.id;
    if (!targetCollectionId) {
      const newCol: Collection = { id: crypto.randomUUID(), name: 'Default Collection', requests: [] };
      setCollections([newCol]);
      targetCollectionId = newCol.id;
    }

    setCollections(cols => cols.map(c => c.id === targetCollectionId ? {
      ...c, requests: [...c.requests, { ...config, name }]
    } : c));
    
    setSidebarTab('collections');
  };

  return (
    <div className={`flex flex-col min-h-screen ${isCompact ? 'overflow-y-auto' : 'h-screen overflow-hidden'} transition-colors duration-300 ${isDark ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      <header className={`flex items-center justify-between px-4 py-2.5 border-b shrink-0 sticky top-0 z-50 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20">N</div>
            {!isCompact && <h1 className="font-black text-lg tracking-tighter bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">NovaAPI</h1>}
          </div>
          
          <div className={`flex items-center gap-1 p-1 rounded-lg border transition-all ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
            <i className="fas fa-globe text-[10px] text-slate-500 ml-1"></i>
            <select
              value={activeEnvId || ''}
              onChange={(e) => setActiveEnvId(e.target.value || null)}
              className={`text-[10px] font-bold bg-transparent outline-none px-2 py-0.5 min-w-[100px] transition-colors ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'}`}
            >
              <option value="">No Environment</option>
              {environments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <button onClick={() => setShowSettings(true)} className={`p-2 rounded-md transition-all ${isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`} title="Settings">
            <i className="fas fa-cog"></i>
          </button>
          <button onClick={toggleTheme} className={`p-2 rounded-md transition-all ${isDark ? 'text-yellow-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`} title="Theme">
            <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
          
          <div className="h-4 w-px bg-slate-800 mx-1"></div>

          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-blue-500">{user.username}</span>
              <button onClick={() => setUser(null)} className="text-[10px] font-bold text-slate-500 hover:text-red-500 uppercase">Logout</button>
            </div>
          ) : (
            <button onClick={() => setShowAuth(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all">Join</button>
          )}
        </div>
      </header>

      {/* Modals */}
      {showDeployment && <DeploymentModal theme={theme} onClose={() => setShowDeployment(false)} files={{ 'index.html': document.documentElement.outerHTML }} />}
      {showImport && <ImportModal theme={theme} onClose={() => setShowImport(false)} onImport={(c) => setConfig(prev => ({ ...prev, ...c }))} />}
      {showSettings && <SettingsModal theme={theme} onClose={() => setShowSettings(false)} environments={environments} onUpdateEnvironments={setEnvironments} />}
      {showAuth && <AuthModal theme={theme} onClose={() => setShowAuth(false)} onAuth={setUser} />}

      <main className={`flex-1 flex ${isCompact ? 'flex-col' : 'flex-row'} overflow-hidden`}>
        {!isCompact && (
          <aside className={`w-72 border-r flex flex-col shrink-0 transition-colors ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <div className={`flex border-b shrink-0 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <button onClick={() => setSidebarTab('history')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${sidebarTab === 'history' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>History</button>
              <button onClick={() => setSidebarTab('collections')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${sidebarTab === 'collections' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Collections</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {sidebarTab === 'history' ? (
                history.map(item => (
                  <button key={item.id} onClick={() => setConfig(item.request)} className={`w-full text-left p-2 rounded group transition-all mb-1 border ${isDark ? 'hover:bg-slate-800 border-transparent hover:border-slate-700' : 'hover:bg-blue-50 border-transparent hover:border-blue-100'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-bold px-1 rounded ${item.request.method === 'GET' ? 'text-green-500 bg-green-500/10' : 'text-blue-500 bg-blue-500/10'}`}>{item.request.method}</span>
                      <span className={`text-[9px] font-bold ${item.responseStatus && item.responseStatus < 300 ? 'text-green-500' : 'text-red-500'}`}>{item.responseStatus || 'ERR'}</span>
                    </div>
                    <div className={`text-[10px] truncate mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.request.url}</div>
                  </button>
                ))
              ) : (
                collections.map(col => (
                  <div key={col.id} className="mb-4">
                    <div className="px-2 py-1 flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{col.name}</span>
                    </div>
                    {col.requests.map((req, i) => (
                      <button key={i} onClick={() => setConfig(req)} className={`w-full text-left p-2 rounded group transition-all mb-1 border ${isDark ? 'hover:bg-slate-800 border-transparent hover:border-slate-700' : 'hover:bg-blue-50 border-transparent hover:border-blue-100'}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold w-10 text-center rounded ${req.method === 'GET' ? 'text-green-500 bg-green-500/10' : 'text-blue-500 bg-blue-500/10'}`}>{req.method}</span>
                          <span className="text-[10px] font-bold truncate">{req.name || 'Untitled'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </aside>
        )}

        <div className={`flex-1 flex ${isCompact ? 'flex-col' : 'flex-row'} overflow-hidden`}>
          {/* Request Panel */}
          <section className={`flex flex-col border-slate-800 ${isCompact ? 'w-full' : 'w-1/2 border-r'} transition-colors ${isDark ? '' : 'bg-white'}`}>
            <div className={`p-4 border-b flex flex-col gap-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
              <div className="flex gap-2">
                <select 
                  value={config.method}
                  onChange={(e) => setConfig({ ...config, method: e.target.value as Method })}
                  className={`border rounded-lg px-3 py-2 text-xs font-black outline-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 text-blue-400' : 'bg-slate-50 border-slate-200 text-blue-600'}`}
                >
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <input
                  type="text"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://api.example.com/v1/{{resource}}..."
                  className={`flex-1 border rounded-lg px-4 py-2 text-xs outline-none font-mono transition-all focus:ring-2 focus:ring-blue-500/20 ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200 focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-400'}`}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSend} disabled={loading} className="flex-1 py-2.5 rounded-lg font-black text-xs bg-blue-600 hover:bg-blue-500 text-white disabled:bg-slate-400 flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all">
                  {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                  EXECUTE
                </button>
                <button onClick={saveToCollection} className={`px-4 rounded-lg text-xs font-bold border transition-all ${isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`} title="Save Request">
                  <i className="fas fa-save"></i>
                </button>
                <button onClick={() => setShowImport(true)} className={`px-4 rounded-lg text-xs font-bold border transition-all ${isDark ? 'border-slate-700 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`} title="Import cURL/SOAP">
                  <i className="fas fa-file-import"></i>
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              <div className={`flex border-b overflow-x-auto no-scrollbar ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                {(['params', 'headers', 'body', 'script'] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab}</button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'headers' && (
                  <div className="space-y-2">
                    {config.headers.map((h, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input type="checkbox" checked={h.enabled} onChange={(e) => {
                          const h2 = [...config.headers]; h2[i].enabled = e.target.checked; setConfig({...config, headers: h2});
                        }} className="w-4 h-4 accent-blue-600" />
                        <input type="text" value={h.key} placeholder="Header" onChange={(e) => {
                          const h2 = [...config.headers]; h2[i].key = e.target.value; setConfig({...config, headers: h2});
                        }} className={`flex-1 border rounded px-3 py-2 text-xs outline-none ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800'}`} />
                        <input type="text" value={h.value} placeholder="Value" onChange={(e) => {
                          const h2 = [...config.headers]; h2[i].value = e.target.value; setConfig({...config, headers: h2});
                        }} className={`flex-1 border rounded px-3 py-2 text-xs outline-none ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800'}`} />
                        <button onClick={() => setConfig({...config, headers: config.headers.filter((_, idx) => idx !== i)})} className="p-2 text-slate-600 hover:text-red-500"><i className="fas fa-trash-alt text-xs"></i></button>
                      </div>
                    ))}
                    <button onClick={() => setConfig({...config, headers: [...config.headers, {key: '', value: '', enabled: true}]})} className="text-[10px] text-blue-500 mt-2 font-bold uppercase hover:underline transition-all">+ Add Row</button>
                  </div>
                )}
                {activeTab === 'body' && <div className="h-full min-h-[250px]"><Editor theme={theme} value={config.body} onChange={(v) => setConfig({...config, body: v})} placeholder="Request payload... use {{variable}} for environment values" /></div>}
                {activeTab === 'script' && <div className="h-full min-h-[250px]"><Editor theme={theme} value={config.transformationScript} onChange={(v) => setConfig({...config, transformationScript: v})} /></div>}
              </div>
            </div>
          </section>

          {/* Response Panel */}
          <section className={`flex flex-col ${isCompact ? 'w-full' : 'w-1/2'} transition-colors ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
             <div className={`p-4 border-b flex justify-between items-center h-[68px] ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
               <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Response Stream</h3>
               {originalResponse && (
                 <div className="flex items-center gap-3">
                   <div className="flex flex-col items-end">
                     <span className={`text-[10px] font-black ${originalResponse.status < 300 ? 'text-green-500' : 'text-red-500'}`}>{originalResponse.status} {originalResponse.statusText}</span>
                     <span className="text-[9px] text-slate-500 font-bold">{originalResponse.time}ms • {originalResponse.size}</span>
                   </div>
                   <button onClick={() => setIsEditingResponse(!isEditingResponse)} className={`text-[10px] p-2 rounded-lg transition-all ${isEditingResponse ? 'bg-blue-600 text-white' : isDark ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-white border border-slate-200 text-slate-600 shadow-sm'}`}>
                     <i className="fas fa-pencil-alt"></i>
                   </button>
                 </div>
               )}
             </div>

             <div className="flex-1 flex flex-col overflow-hidden">
               {originalResponse ? (
                 <>
                   <div className={`flex border-b overflow-x-auto no-scrollbar ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                     {(['body', 'table', 'code'] as const).map(tab => (
                       <button key={tab} onClick={() => setRespTab(tab)} className={`px-5 py-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all shrink-0 ${respTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{tab}</button>
                     ))}
                   </div>
                   <div className="flex-1 overflow-y-auto p-4">
                     {respTab === 'body' && (
                       <div className="h-full flex flex-col gap-3">
                         {originalResponse.type === 'json' && (
                           <JsonOps theme={theme} data={processedData} onDataChange={setProcessedData} onActionGenerated={setCurrentActionCode} />
                         )}
                         {currentActionCode && (
                           <div className={`border p-3 rounded-xl flex justify-between items-center mb-1 animate-in slide-in-from-top-2 ${isDark ? 'bg-blue-600/10 border-blue-600/30' : 'bg-blue-50 border-blue-100'}`}>
                             <code className={`text-[10px] truncate font-mono flex-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>{currentActionCode}</code>
                             <div className="flex gap-2 ml-4">
                               <button onClick={() => setCurrentActionCode('')} className="text-[10px] font-bold text-slate-500 uppercase">Clear</button>
                               <button onClick={() => {
                                 const cleanAction = currentActionCode.startsWith('data.') ? `data = ${currentActionCode};` : `data = ${currentActionCode.replace('data', 'data')};`;
                                 const newScript = `${config.transformationScript}\n\n// UI Generated:\n${cleanAction}\nreturn data;`;
                                 setConfig({ ...config, transformationScript: newScript });
                                 setActiveTab('script');
                               }} className="text-[10px] font-black bg-blue-600 text-white px-3 py-1 rounded-lg shadow-lg shadow-blue-500/20">APPLY</button>
                             </div>
                           </div>
                         )}
                         <div className="flex-1 min-h-[350px]">
                           <Editor theme={theme} value={typeof processedData === 'object' ? JSON.stringify(processedData, null, 2) : String(processedData)} onChange={(v) => { try { setProcessedData(JSON.parse(v)); } catch(e) {} }} readOnly={!isEditingResponse} />
                         </div>
                       </div>
                     )}
                     {respTab === 'table' && <DataTable theme={theme} data={processedData} onActionGenerated={setCurrentActionCode} mode={config.processingMode} onModeChange={(m) => setConfig({...config, processingMode: m})} onServerSideAction={() => {}} />}
                     {respTab === 'code' && (
                       <div className="h-full flex flex-col gap-3">
                         <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                           {LANGUAGES.map(l => (
                             <button key={l.id} onClick={() => setCodeLanguage(l.id)} className={`px-3 py-1 text-[9px] font-black rounded-full border transition-all ${codeLanguage === l.id ? 'bg-blue-600 border-blue-500 text-white' : isDark ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600 shadow-sm'}`}>{l.name}</button>
                           ))}
                         </div>
                         <div className="flex-1">
                          <Editor theme={theme} value={generatedCode} onChange={() => {}} readOnly />
                         </div>
                       </div>
                     )}
                   </div>
                 </>
               ) : (
                 <div className="flex-1 flex flex-col items-center justify-center p-12 opacity-20">
                   <i className={`fas fa-bolt text-6xl mb-6 ${isDark ? 'text-slate-800' : 'text-slate-300'}`}></i>
                   <p className="text-[11px] font-black uppercase tracking-[0.2em] text-center">Standby for transmission</p>
                 </div>
               )}
             </div>
          </section>
        </div>
      </main>

      <footer className={`border-t px-4 py-2 flex justify-between items-center text-[10px] font-mono shrink-0 transition-colors ${isDark ? 'bg-slate-950 border-slate-900 text-slate-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span> LOCAL ENGINE ACTIVE</span>
          {activeEnv && <span className="text-blue-500/80 font-black">ENV: {activeEnv.name.toUpperCase()}</span>}
        </div>
        <div className="flex items-center gap-4">
          <span>{isExtension ? 'SECURE_EXTENSION_CHANNEL' : 'BROWSER_NATIVE_MODE'}</span>
          <span className="opacity-50">V1.5.0</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
