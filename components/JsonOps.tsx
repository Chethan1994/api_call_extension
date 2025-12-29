
import React, { useState, useMemo } from 'react';

interface Criterion {
  id: string;
  field: string;
  op: string;
  value: string;
}

interface JsonOpsProps {
  data: any;
  onDataChange: (newData: any) => void;
  onActionGenerated: (code: string) => void;
  theme?: 'dark' | 'light';
}

export const JsonOps: React.FC<JsonOpsProps> = ({ data, onDataChange, onActionGenerated, theme = 'dark' }) => {
  const [searchKey, setSearchKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [matchType, setMatchType] = useState<'AND' | 'OR'>('AND');
  const [criteria, setCriteria] = useState<Criterion[]>([]);

  const isDark = theme === 'dark';

  const availableFields = useMemo(() => {
    if (!data) return [];
    const items = Array.isArray(data) ? data.slice(0, 50) : [data];
    const fieldSet = new Set<string>();
    const extractPaths = (obj: any, prefix = '') => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
      Object.keys(obj).forEach(k => {
        const path = prefix ? `${prefix}.${k}` : k;
        fieldSet.add(path);
        if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k]) && Object.keys(obj[k]).length < 10 && path.split('.').length < 3) {
          extractPaths(obj[k], path);
        }
      });
    };
    items.forEach(item => extractPaths(item));
    return Array.from(fieldSet).sort();
  }, [data]);

  const addCriterion = () => setCriteria([...criteria, { id: crypto.randomUUID(), field: availableFields[0] || '', op: 'contains', value: '' }]);
  const removeCriterion = (id: string) => setCriteria(criteria.filter(c => c.id !== id));
  const updateCriterion = (id: string, updates: Partial<Criterion>) => setCriteria(criteria.map(c => c.id === id ? { ...c, ...updates } : c));

  const handleAdvancedSearch = () => {
    if (!Array.isArray(data)) return;
    const getValueByPath = (obj: any, path: string) => path.split('.').reduce((prev, curr) => prev?.[curr], obj);
    const filterFn = (item: any) => {
      const results = criteria.map(c => {
        const val = getValueByPath(item, c.field);
        const itemStr = String(val ?? '').toLowerCase();
        const targetStr = c.value.toLowerCase();
        switch (c.op) {
          case 'equals': return String(val) === c.value;
          case 'contains': return itemStr.includes(targetStr);
          case 'gt': return Number(val) > Number(c.value);
          case 'lt': return Number(val) < Number(c.value);
          case 'startsWith': return itemStr.startsWith(targetStr);
          case 'endsWith': return itemStr.endsWith(targetStr);
          case 'regex': try { return new RegExp(c.value, 'i').test(String(val)); } catch { return false; }
          case 'isEmpty': return val === null || val === undefined || val === '';
          case 'isNotEmpty': return val !== null && val !== undefined && val !== '';
          default: return true;
        }
      });
      return matchType === 'AND' ? results.every(r => r === true) : results.some(r => r === true);
    };
    onDataChange(data.filter(filterFn));
  };

  const handleQuickOp = (type: 'keys' | 'values' | 'flatten') => {
    let result = data;
    switch (type) {
      case 'keys': result = Array.isArray(data) ? data.map(i => Object.keys(i)) : Object.keys(data); break;
      case 'values': result = Array.isArray(data) ? data.map(i => Object.values(i)) : Object.values(data); break;
      case 'flatten':
        const flatten = (obj: any, prefix = ''): any => {
          if (!obj || typeof obj !== 'object') return obj;
          return Object.keys(obj).reduce((acc: any, k: string) => {
            const pre = prefix.length ? prefix + '.' : '';
            if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) Object.assign(acc, flatten(obj[k], pre + k));
            else acc[pre + k] = obj[k];
            return acc;
          }, {});
        };
        result = Array.isArray(data) ? data.map(i => flatten(i)) : flatten(data);
        break;
    }
    onDataChange(result);
  };

  return (
    <div className={`flex flex-col gap-2 mb-4 p-2 md:p-3 border rounded-lg shadow-sm ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="Quick search (e.g. status=active)..."
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            className={`flex-1 border rounded px-3 py-1.5 text-[10px] md:text-xs outline-none focus:border-blue-500 font-mono transition-all ${
              isDark ? 'bg-slate-950 border-slate-800 text-blue-300 placeholder:text-slate-700' : 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-300'
            }`}
          />
          <button className="bg-blue-600 hover:bg-blue-500 text-white px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold transition-all uppercase whitespace-nowrap">Find</button>
        </div>
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-1.5 rounded text-[9px] md:text-[10px] font-bold transition-all uppercase border flex items-center gap-2 ${
            showAdvanced 
              ? 'bg-indigo-600 border-indigo-500 text-white' 
              : isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'
          }`}
        >
          <i className="fas fa-filter"></i>
          {showAdvanced ? 'Close' : 'Advanced'}
        </button>
      </div>

      {showAdvanced && (
        <div className={`mt-2 p-3 rounded-lg border flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
          <div className="flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Query Engine</h4>
            <div className={`flex rounded p-0.5 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              {(['AND', 'OR'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setMatchType(type)}
                  className={`px-2 py-0.5 text-[8px] font-black rounded uppercase transition-all ${matchType === type ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-400'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <button onClick={addCriterion} className="text-blue-500 hover:text-blue-400 text-[10px] font-bold flex items-center gap-1 self-start uppercase tracking-wider">
            <i className="fas fa-plus-circle"></i> Add Filter
          </button>
          <div className="space-y-2">
            {criteria.map((c) => (
              <div key={c.id} className={`flex gap-2 items-center p-2 border rounded-md ${isDark ? 'bg-slate-900/50 border-slate-800/50' : 'bg-slate-50/50 border-slate-100'}`}>
                <select value={c.field} onChange={(e) => updateCriterion(c.id, { field: e.target.value })} className={`flex-1 min-w-[100px] border rounded px-2 py-1.5 text-[10px] outline-none ${isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                  {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <input type="text" placeholder="Value..." value={c.value} onChange={(e) => updateCriterion(c.id, { value: e.target.value })} className={`flex-1 border rounded px-2 py-1.5 text-[10px] outline-none font-mono ${isDark ? 'bg-slate-900 border-slate-800 text-blue-300' : 'bg-white border-slate-200 text-slate-800'}`} />
                <button onClick={() => removeCriterion(c.id)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"><i className="fas fa-trash-alt text-[10px]"></i></button>
              </div>
            ))}
          </div>
          <button onClick={handleAdvancedSearch} className="bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded text-[10px] font-bold uppercase transition-all shadow-lg">Run Engine</button>
        </div>
      )}

      <div className={`flex flex-wrap gap-2 pt-1 border-t mt-1 ${isDark ? 'border-slate-800/50' : 'border-slate-200/50'}`}>
        {['keys', 'values', 'flatten'].map(op => (
          <button key={op} onClick={() => handleQuickOp(op as any)} className={`flex-1 text-[9px] px-2 py-1 rounded border font-bold uppercase transition-colors ${
            isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-white hover:bg-slate-50 text-slate-500 border-slate-200'
          }`}>{op}</button>
        ))}
      </div>
    </div>
  );
};