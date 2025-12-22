
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
}

export const JsonOps: React.FC<JsonOpsProps> = ({ data, onDataChange, onActionGenerated }) => {
  const [searchKey, setSearchKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [matchType, setMatchType] = useState<'AND' | 'OR'>('AND');
  const [criteria, setCriteria] = useState<Criterion[]>([]);

  // Deep Schema Discovery: Scans up to 50 items to find all available keys
  const availableFields = useMemo(() => {
    if (!data) return [];
    const items = Array.isArray(data) ? data.slice(0, 50) : [data];
    const fieldSet = new Set<string>();

    const extractPaths = (obj: any, prefix = '') => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
      Object.keys(obj).forEach(k => {
        const path = prefix ? `${prefix}.${k}` : k;
        fieldSet.add(path);
        // Only recurse if object is small and not too deep to avoid UI lag
        if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k]) && Object.keys(obj[k]).length < 10 && path.split('.').length < 3) {
          extractPaths(obj[k], path);
        }
      });
    };

    items.forEach(item => extractPaths(item));
    return Array.from(fieldSet).sort();
  }, [data]);

  const addCriterion = () => {
    setCriteria([...criteria, { 
      id: crypto.randomUUID(), 
      field: availableFields[0] || '', 
      op: 'contains', 
      value: '' 
    }]);
  };

  const removeCriterion = (id: string) => {
    setCriteria(criteria.filter(c => c.id !== id));
  };

  const updateCriterion = (id: string, updates: Partial<Criterion>) => {
    setCriteria(criteria.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const handleAdvancedSearch = () => {
    if (!Array.isArray(data)) return;
    
    let codeParts: string[] = [];
    const getValueByPath = (obj: any, path: string) => {
      return path.split('.').reduce((prev, curr) => prev?.[curr], obj);
    };

    const filterFn = (item: any) => {
      const results = criteria.map(c => {
        if (!c.field && c.op !== 'search') return true;
        
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
          case 'regex': 
            try { return new RegExp(c.value, 'i').test(String(val)); } catch { return false; }
          case 'isEmpty': return val === null || val === undefined || val === '';
          case 'isNotEmpty': return val !== null && val !== undefined && val !== '';
          default: return true;
        }
      });

      if (criteria.length === 0) return true;
      return matchType === 'AND' 
        ? results.every(r => r === true)
        : results.some(r => r === true);
    };

    const filteredResult = data.filter(filterFn);

    // Generate Code Snippet
    if (criteria.length > 0) {
      const jsLogic = criteria.map(c => {
        let snippet = '';
        const path = `item['${c.field.split('.').join("']['")}']`;
        switch (c.op) {
          case 'equals': snippet = `String(${path}) === '${c.value}'`; break;
          case 'contains': snippet = `String(${path} || '').toLowerCase().includes('${c.value.toLowerCase()}')`; break;
          case 'gt': snippet = `Number(${path}) > ${c.value}`; break;
          case 'lt': snippet = `Number(${path}) < ${c.value}`; break;
          case 'startsWith': snippet = `String(${path} || '').toLowerCase().startsWith('${c.value.toLowerCase()}')`; break;
          case 'endsWith': snippet = `String(${path} || '').toLowerCase().endsWith('${c.value.toLowerCase()}')`; break;
          case 'regex': snippet = `new RegExp('${c.value}', 'i').test(String(${path}))`; break;
          case 'isEmpty': snippet = `(${path} === null || ${path} === undefined || ${path} === '')`; break;
          case 'isNotEmpty': snippet = `(${path} !== null && ${path} !== undefined && ${path} !== '')`; break;
        }
        return snippet;
      }).join(matchType === 'AND' ? ' && ' : ' || ');
      
      onActionGenerated(`data.filter(item => ${jsLogic})`);
    }

    onDataChange(filteredResult);
  };

  const handleQuickOp = (type: 'keys' | 'values' | 'flatten') => {
    if (!data) return;
    let result = data;
    let code = '';

    switch (type) {
      case 'keys':
        result = Array.isArray(data) ? data.map(i => Object.keys(i)) : Object.keys(data);
        code = `data${Array.isArray(data) ? '.map(i => Object.keys(i))' : '.keys()'}`;
        break;
      case 'values':
        result = Array.isArray(data) ? data.map(i => Object.values(i)) : Object.values(data);
        code = `data${Array.isArray(data) ? '.map(i => Object.values(i))' : '.values()'}`;
        break;
      case 'flatten':
        const flatten = (obj: any, prefix = ''): any => {
          if (!obj || typeof obj !== 'object') return obj;
          return Object.keys(obj).reduce((acc: any, k: string) => {
            const pre = prefix.length ? prefix + '.' : '';
            if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
              Object.assign(acc, flatten(obj[k], pre + k));
            } else {
              acc[pre + k] = obj[k];
            }
            return acc;
          }, {});
        };
        result = Array.isArray(data) ? data.map(i => flatten(i)) : flatten(data);
        code = `data.map(item => flatten(item))`;
        break;
    }
    onDataChange(result);
    onActionGenerated(code);
  };

  const handleQuickSearch = () => {
    if (!searchKey) return;
    const findByPredicate = (obj: any, targetKey: string, targetValue: string): any[] => {
      let results: any[] = [];
      if (!obj || typeof obj !== 'object') return results;
      if (Array.isArray(obj)) {
        obj.forEach(item => results = results.concat(findByPredicate(item, targetKey, targetValue)));
      } else {
        if (String(obj[targetKey]) === targetValue) results.push(obj);
        Object.keys(obj).forEach(k => {
          if (typeof obj[k] === 'object' && obj[k] !== null) results = results.concat(findByPredicate(obj[k], targetKey, targetValue));
        });
      }
      return results.filter((v, i, a) => a.indexOf(v) === i);
    };

    if (searchKey.includes('=') || searchKey.includes('==')) {
      const delimiter = searchKey.includes('==') ? '==' : '=';
      const [k, ...vParts] = searchKey.split(delimiter);
      const targetKey = k.trim();
      const v = vParts.join(delimiter).trim();
      const result = findByPredicate(data, targetKey, v);
      onDataChange(result);
      onActionGenerated(`data.filter(item => String(item['${targetKey}']) === '${v}')`);
    }
  };

  return (
    <div className="flex flex-col gap-2 mb-4 p-2 md:p-3 bg-slate-900 border border-slate-800 rounded-lg shadow-sm">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-1 gap-2">
          <input
            type="text"
            placeholder="Quick search (e.g. status=active)..."
            value={searchKey}
            onChange={(e) => setSearchKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickSearch()}
            className="flex-1 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-[10px] md:text-xs text-blue-300 outline-none focus:border-blue-500 placeholder:text-slate-700 font-mono"
          />
          <button 
            onClick={handleQuickSearch}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3 md:px-4 py-1.5 rounded text-[9px] md:text-[10px] font-bold transition-all uppercase whitespace-nowrap"
          >
            Find
          </button>
        </div>
        <button 
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-1.5 rounded text-[9px] md:text-[10px] font-bold transition-all uppercase border flex items-center gap-2 ${
            showAdvanced ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          <i className={`fas fa-filter ${showAdvanced ? 'animate-pulse' : ''}`}></i>
          {showAdvanced ? 'Close Advanced' : 'Advanced Search'}
        </button>
      </div>

      {showAdvanced && (
        <div className="mt-2 p-3 bg-slate-950/50 rounded-lg border border-slate-800 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-4">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Multi-Field Engine</h4>
              <div className="flex bg-slate-900 rounded p-0.5 border border-slate-800">
                {(['AND', 'OR'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setMatchType(type)}
                    className={`px-2 py-0.5 text-[8px] font-black rounded uppercase transition-all ${
                      matchType === type ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {type === 'AND' ? 'Match All' : 'Match Any'}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={addCriterion} className="text-blue-500 hover:text-blue-400 text-[10px] font-bold flex items-center gap-1 transition-colors">
              <i className="fas fa-plus-circle"></i> ADD CRITERION
            </button>
          </div>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {criteria.map((c) => (
              <div key={c.id} className="flex flex-wrap md:flex-nowrap gap-2 items-center p-2 bg-slate-900/50 border border-slate-800/50 rounded-md">
                <select 
                  value={c.field}
                  onChange={(e) => updateCriterion(c.id, { field: e.target.value })}
                  className="flex-1 min-w-[120px] bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[10px] text-slate-300 outline-none focus:border-blue-500"
                >
                  <option value="" disabled>Select Field...</option>
                  {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select 
                  value={c.op}
                  onChange={(e) => updateCriterion(c.id, { op: e.target.value })}
                  className="w-full md:w-36 bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[10px] text-slate-300 outline-none focus:border-blue-500"
                >
                  <option value="contains">Contains</option>
                  <option value="equals">Equals</option>
                  <option value="startsWith">Starts With</option>
                  <option value="endsWith">Ends With</option>
                  <option value="gt">Greater Than</option>
                  <option value="lt">Less Than</option>
                  <option value="regex">Regex Match</option>
                  <option value="isEmpty">Is Empty</option>
                  <option value="isNotEmpty">Is Not Empty</option>
                </select>
                {c.op !== 'isEmpty' && c.op !== 'isNotEmpty' && (
                  <input 
                    type="text"
                    placeholder="Value..."
                    value={c.value}
                    onChange={(e) => updateCriterion(c.id, { value: e.target.value })}
                    className="flex-1 min-w-[120px] bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-[10px] text-blue-300 outline-none focus:border-blue-500 font-mono"
                  />
                )}
                <button 
                  onClick={() => removeCriterion(c.id)}
                  className="p-1.5 text-slate-600 hover:text-red-500 transition-colors"
                >
                  <i className="fas fa-trash-alt text-[10px]"></i>
                </button>
              </div>
            ))}
            {criteria.length === 0 && (
              <div className="text-center py-6 border-2 border-dashed border-slate-800 rounded-lg">
                <p className="text-[10px] text-slate-600 italic uppercase tracking-widest">No Active Filters</p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <button 
              onClick={handleAdvancedSearch}
              disabled={criteria.length === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white py-2 rounded text-[10px] font-bold uppercase transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              <i className="fas fa-play text-[8px]"></i>
              Execute Filter Engine
            </button>
            <button 
              onClick={() => { setCriteria([]); handleAdvancedSearch(); }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded text-[10px] font-bold uppercase transition-all"
            >
              Reset All
            </button>
          </div>
          {Array.isArray(data) && (
            <div className="pt-2 border-t border-slate-800 text-center">
              <span className="text-[9px] text-slate-600 font-mono">
                DISCOVERED <span className="text-blue-500">{availableFields.length}</span> FIELDS IN <span className="text-blue-500">{Math.min(data.length, 50)}</span> RECORDS
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/50 mt-1">
        <button onClick={() => handleQuickOp('keys')} className="flex-1 text-[9px] md:text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 font-bold uppercase transition-colors">Keys Only</button>
        <button onClick={() => handleQuickOp('values')} className="flex-1 text-[9px] md:text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 font-bold uppercase transition-colors">Values Only</button>
        <button onClick={() => handleQuickOp('flatten')} className="flex-1 text-[9px] md:text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded border border-slate-700 font-bold uppercase transition-colors">Flatten All</button>
      </div>
    </div>
  );
};
