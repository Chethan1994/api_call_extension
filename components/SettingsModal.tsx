
import React, { useState } from 'react';
import { Environment, EnvVariable } from '../types';

interface SettingsModalProps {
  onClose: () => void;
  environments: Environment[];
  onUpdateEnvironments: (envs: Environment[]) => void;
  theme?: 'dark' | 'light';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, environments, onUpdateEnvironments, theme = 'dark' }) => {
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(environments[0]?.id || null);
  const isDark = theme === 'dark';

  const activeEnv = environments.find(e => e.id === selectedEnvId);

  const addEnv = () => {
    const newEnv: Environment = { id: crypto.randomUUID(), name: 'New Environment', variables: [] };
    onUpdateEnvironments([...environments, newEnv]);
    setSelectedEnvId(newEnv.id);
  };

  const updateEnvName = (id: string, name: string) => {
    onUpdateEnvironments(environments.map(e => e.id === id ? { ...e, name } : e));
  };

  const deleteEnv = (id: string) => {
    onUpdateEnvironments(environments.filter(e => e.id !== id));
    if (selectedEnvId === id) setSelectedEnvId(environments[0]?.id || null);
  };

  const addVariable = () => {
    if (!selectedEnvId) return;
    onUpdateEnvironments(environments.map(e => e.id === selectedEnvId ? {
      ...e, variables: [...e.variables, { key: '', value: '', enabled: true }]
    } : e));
  };

  const updateVariable = (index: number, updates: Partial<EnvVariable>) => {
    if (!selectedEnvId) return;
    onUpdateEnvironments(environments.map(e => e.id === selectedEnvId ? {
      ...e, variables: e.variables.map((v, i) => i === index ? { ...v, ...updates } : v)
    } : e));
  };

  const deleteVariable = (index: number) => {
    if (!selectedEnvId) return;
    onUpdateEnvironments(environments.map(e => e.id === selectedEnvId ? {
      ...e, variables: e.variables.filter((_, i) => i !== index)
    } : e));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`border rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex overflow-hidden animate-slide-in ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        {/* Sidebar */}
        <div className={`w-48 border-r flex flex-col ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Environments</h3>
            <button onClick={addEnv} className="text-blue-500 hover:text-blue-400"><i className="fas fa-plus-circle"></i></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {environments.map(env => (
              <button
                key={env.id}
                onClick={() => setSelectedEnvId(env.id)}
                className={`w-full text-left px-4 py-3 text-xs transition-colors border-b last:border-0 flex justify-between items-center group ${
                  selectedEnvId === env.id 
                    ? 'bg-blue-600/10 text-blue-400 font-bold border-blue-500/30' 
                    : isDark ? 'text-slate-400 border-slate-800 hover:bg-slate-900' : 'text-slate-600 border-slate-100 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">{env.name}</span>
                <i onClick={(e) => { e.stopPropagation(); deleteEnv(env.id); }} className="fas fa-trash-alt opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 transition-opacity"></i>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <h2 className={`text-sm font-bold uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-800'}`}>Environment Settings</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-700"><i className="fas fa-times"></i></button>
          </div>

          {activeEnv ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-6">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Environment Name</label>
                <input
                  type="text"
                  value={activeEnv.name}
                  onChange={(e) => updateEnvName(activeEnv.id, e.target.value)}
                  className={`w-full max-w-sm border rounded px-3 py-2 text-sm outline-none focus:border-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-blue-400' : 'bg-white border-slate-200 text-slate-800'}`}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Variables</h4>
                  <button onClick={addVariable} className="text-[10px] font-bold text-blue-500 uppercase">+ Add New Variable</button>
                </div>
                <div className="space-y-2">
                  <div className="flex gap-2 text-[10px] font-bold text-slate-500 uppercase px-2">
                    <span className="w-8"></span>
                    <span className="flex-1">Key</span>
                    <span className="flex-1">Value</span>
                    <span className="w-8"></span>
                  </div>
                  {activeEnv.variables.map((v, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input 
                        type="checkbox" 
                        checked={v.enabled} 
                        onChange={(e) => updateVariable(i, { enabled: e.target.checked })}
                        className="w-4 h-4 accent-blue-600"
                      />
                      <input
                        type="text"
                        placeholder="KEY"
                        value={v.key}
                        onChange={(e) => updateVariable(i, { key: e.target.value })}
                        className={`flex-1 border rounded px-2 py-1.5 text-xs outline-none font-mono ${isDark ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800'}`}
                      />
                      <input
                        type="text"
                        placeholder="VALUE"
                        value={v.value}
                        onChange={(e) => updateVariable(i, { value: e.target.value })}
                        className={`flex-1 border rounded px-2 py-1.5 text-xs outline-none font-mono ${isDark ? 'bg-slate-950 border-slate-800 text-blue-400' : 'bg-white border-slate-200 text-slate-800'}`}
                      />
                      <button onClick={() => deleteVariable(i)} className="p-2 text-slate-600 hover:text-red-500 transition-colors"><i className="fas fa-trash-alt text-xs"></i></button>
                    </div>
                  ))}
                  {activeEnv.variables.length === 0 && (
                    <div className="py-12 text-center text-slate-500 text-xs italic opacity-50">No variables defined for this environment.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-40">
              <i className="fas fa-globe text-4xl mb-4"></i>
              <p className="text-sm font-bold uppercase tracking-widest">Select or create an environment</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
