
import React from 'react';

interface EditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export const Editor: React.FC<EditorProps> = ({ value, onChange, placeholder, readOnly = false }) => {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={placeholder}
      className="w-full h-full min-h-[150px] bg-slate-900 text-blue-300 font-mono text-xs md:text-sm p-3 md:p-4 outline-none resize-none border border-slate-700 rounded-md focus:border-blue-500 transition-colors shadow-inner"
      spellCheck={false}
    />
  );
};
