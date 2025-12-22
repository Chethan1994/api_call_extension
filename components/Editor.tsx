
import React from 'react';

interface EditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  theme?: 'dark' | 'light';
}

export const Editor: React.FC<EditorProps> = ({ value, onChange, placeholder, readOnly = false, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`w-full h-full min-h-[150px] font-mono text-xs md:text-sm p-3 md:p-4 outline-none resize-none border rounded-md transition-all shadow-inner ${
        isDark 
          ? 'bg-slate-900 text-blue-300 border-slate-700 focus:border-blue-500' 
          : 'bg-white text-slate-800 border-slate-200 focus:border-blue-400'
      }`}
      spellCheck={false}
    />
  );
};
