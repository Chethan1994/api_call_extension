
import React, { useState, useMemo, useEffect } from 'react';
import { ProcessingMode } from '../types';

interface DataTableProps {
  data: any[];
  onActionGenerated: (code: string) => void;
  mode: ProcessingMode;
  onModeChange: (mode: ProcessingMode) => void;
  onServerSideAction: (params: Record<string, string>, sort: { key: string; order: string } | null) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ data, onActionGenerated, mode, onModeChange, onServerSideAction }) => {
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Reset filters when mode changes
  useEffect(() => {
    setColumnFilters({});
    setSortKey(null);
  }, [mode]);

  const flattenObject = (obj: any, prefix = ''): any => {
    if (obj === null || obj === undefined) return { value: obj };
    if (typeof obj !== 'object') return { value: obj };
    
    return Object.keys(obj).reduce((acc: any, k: string) => {
      const pre = prefix.length ? prefix + '.' : '';
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        Object.assign(acc, flattenObject(obj[k], pre + k));
      } else {
        acc[pre + k] = obj[k];
      }
      return acc;
    }, {});
  };

  const flattenedData = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.map(item => (typeof item === 'object' ? flattenObject(item) : { value: item }));
  }, [data]);

  const headers = useMemo(() => {
    if (!flattenedData.length) return [];
    const allKeys = new Set<string>();
    flattenedData.forEach(item => Object.keys(item).forEach(k => allKeys.add(k)));
    return Array.from(allKeys);
  }, [flattenedData]);

  const processedData = useMemo(() => {
    if (mode === 'server') return flattenedData;

    let result = [...flattenedData];

    // Client-side Column Filter
    // Fixed: Cast 'val' to string to fix 'unknown' type errors for .trim() and .toLowerCase()
    Object.entries(columnFilters).forEach(([key, val]) => {
      const filterVal = val as string;
      if (filterVal && filterVal.trim() !== '') {
        result = result.filter(row => {
          const rowVal = row[key];
          if (rowVal === undefined || rowVal === null) return false;
          return String(rowVal).toLowerCase().includes(filterVal.toLowerCase());
        });
      }
    });

    // Client-side Sort
    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        
        const aVal = typeof valA === 'string' ? valA.toLowerCase() : valA;
        const bVal = typeof valB === 'string' ? valB.toLowerCase() : valB;
        
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        return sortOrder === 'asc' ? 1 : -1;
      });
    }

    return result;
  }, [flattenedData, columnFilters, sortKey, sortOrder, mode]);

  // Generate code snippet or server action
  useEffect(() => {
    if (mode === 'client') {
      const lines: string[] = [];
      // Fixed: Cast 'val' to string to fix 'unknown' type errors for .trim() and .toLowerCase()
      Object.entries(columnFilters).forEach(([key, val]) => {
        const filterVal = val as string;
        if (filterVal && filterVal.trim() !== '') {
          lines.push(`.filter(item => String(item['${key}'] || '').toLowerCase().includes('${filterVal.toLowerCase()}'))`);
        }
      });
      if (sortKey) {
        lines.push(`.sort((a, b) => a['${sortKey}'] ${sortOrder === 'asc' ? '<' : '>'} b['${sortKey}'] ? -1 : 1)`);
      }
      onActionGenerated(lines.length > 0 ? `data${lines.join('')}` : '');
    } else {
      // Server-side action generation - now targeting Request Body
      // Fixed: Cast 'v' to string to fix 'unknown' type error for .trim()
      const activeFilters = Object.fromEntries(
        Object.entries(columnFilters).filter(([_, v]) => {
          const val = v as string;
          return val && val.trim() !== '';
        })
      );
      const hasFilters = Object.keys(activeFilters).length > 0;
      
      if (hasFilters || sortKey) {
        const bodyObj = {
          filters: activeFilters,
          sort: sortKey ? { key: sortKey, order: sortOrder } : null
        };
        onActionGenerated(`Body = ${JSON.stringify(bodyObj)}`);
      } else {
        onActionGenerated('');
      }
    }
  }, [columnFilters, sortKey, sortOrder, mode]);

  const handleSort = (key: string) => {
    const newOrder = sortKey === key && sortOrder === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortOrder(newOrder);

    if (mode === 'server') {
      onServerSideAction(columnFilters, { key, order: newOrder });
    }
  };

  const updateColumnFilter = (key: string, val: string) => {
    const newFilters = { ...columnFilters, [key]: val };
    setColumnFilters(newFilters);
    
    if (mode === 'server') {
      onServerSideAction(newFilters, sortKey ? { key: sortKey, order: sortOrder } : null);
    }
  };

  const downloadCSV = () => {
    const csvRows = [];
    csvRows.push(headers.join(','));
    for (const row of processedData) {
      const values = headers.map(header => {
        const val = row[header];
        const escaped = ('' + (val === null || val === undefined ? '' : val)).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'nova_export.csv');
    a.click();
  };

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex justify-between items-center px-1">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-slate-500 font-mono">
            {mode === 'client' ? `Viewing ${processedData.length} records (Client-side)` : 'Server-side Processing (Body)'}
          </span>
          <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700 shadow-inner">
            <button 
              onClick={() => onModeChange('client')}
              className={`px-3 py-1 text-[9px] font-bold rounded uppercase transition-all ${mode === 'client' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Client
            </button>
            <button 
              onClick={() => onModeChange('server')}
              className={`px-3 py-1 text-[9px] font-bold rounded uppercase transition-all ${mode === 'server' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Server
            </button>
          </div>
        </div>
        <button 
          onClick={downloadCSV}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded text-[10px] font-bold border border-slate-700 transition-all uppercase flex items-center gap-2"
        >
          <i className="fas fa-file-csv"></i> Export CSV
        </button>
      </div>
      
      <div className="flex-1 overflow-auto border border-slate-800 rounded-lg bg-slate-900 shadow-inner">
        <table className="w-full text-left text-[11px] border-collapse table-fixed">
          <thead className="sticky top-0 bg-slate-800 z-10 shadow-md">
            <tr>
              {headers.map((header) => (
                <th key={header} className="p-0 border-b border-slate-700 min-w-[160px]">
                  <div 
                    onClick={() => handleSort(header)}
                    className="px-3 py-2 cursor-pointer hover:bg-slate-700 transition-colors flex items-center justify-between group"
                  >
                    <span className="font-bold text-slate-400 uppercase tracking-tighter truncate" title={header}>{header}</span>
                    <span className="text-blue-500">
                      {sortKey === header ? (
                        <i className={`fas fa-sort-amount-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                      ) : (
                        <i className="fas fa-sort text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"></i>
                      )}
                    </span>
                  </div>
                  <div className="px-2 pb-2">
                    <input
                      type="text"
                      placeholder={`Search...`}
                      value={columnFilters[header] || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateColumnFilter(header, e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-blue-300 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder:text-slate-700"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedData.map((row, i) => (
              <tr key={i} className="hover:bg-slate-800/40 border-b border-slate-800/50 group transition-colors">
                {headers.map((header) => (
                  <td key={header} className="px-3 py-2 overflow-hidden text-ellipsis whitespace-nowrap text-slate-300 group-hover:text-white transition-colors border-r border-slate-800/30 last:border-r-0">
                    {row[header] === null || row[header] === undefined ? <span className="text-slate-600 italic">null</span> : String(row[header])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {processedData.length === 0 && (
          <div className="p-12 text-center text-slate-600 flex flex-col items-center gap-2">
             <i className="fas fa-filter text-4xl opacity-10 mb-2"></i>
             <p className="font-bold uppercase tracking-widest text-[11px] text-slate-500">No results found for current filters</p>
          </div>
        )}
      </div>
    </div>
  );
};
