
import React, { useState } from 'react';
import JSZip from 'jszip';

interface DeploymentModalProps {
  onClose: () => void;
  files: Record<string, string>;
  theme?: 'dark' | 'light';
}

export const DeploymentModal: React.FC<DeploymentModalProps> = ({ onClose, files, theme = 'dark' }) => {
  const [activeTab, setActiveTab] = useState<'chrome' | 'vscode'>('chrome');
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isDark = theme === 'dark';

  const [metadata, setMetadata] = useState({
    version: '1.5.0',
    author: 'NovaTools',
    description: 'Advanced API client for developers',
  });

  const handleDeploy = async () => {
    setDeploying(true);
    setProgress(10);
    setError(null);
    try {
      const zip = new JSZip();
      Object.entries(files).forEach(([path, content]) => {
        if (!path.includes('manifest.json') && !path.includes('package.json')) zip.file(path, content);
      });
      if (activeTab === 'chrome') {
        const manifest = {
          manifest_version: 3,
          name: "NovaAPI - Advanced API Client",
          version: metadata.version,
          description: metadata.description,
          permissions: ["storage", "sidePanel"],
          host_permissions: ["<all_urls>"],
          action: { default_popup: "index.html", default_title: "Open NovaAPI" },
          side_panel: { default_path: "index.html" },
          icons: { "128": "https://cdn-icons-png.flaticon.com/512/807/807262.png" }
        };
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      } else {
        const packageJson = {
          name: "novaapi-vscode",
          displayName: "NovaAPI",
          description: metadata.description,
          version: metadata.version,
          publisher: metadata.author.toLowerCase().replace(/\s+/g, '-'),
          engines: { vscode: "^1.75.0" },
          categories: ["Network", "Other"],
          main: "./extension.js",
          contributes: {
            commands: [{ command: "novaapi.open", title: "NovaAPI: Open Dashboard" }],
            viewsContainers: { activitybar: [{ id: "novaapi-explorer", title: "NovaAPI", icon: "$(radio-tower)" }] },
            views: { "novaapi-explorer": [{ id: "novaapi.main", name: "NovaAPI Client", type: "webview" }] }
          }
        };
        const extensionJs = `const vscode = require('vscode');const path = require('path');const fs = require('fs');function activate(context) {let disposable = vscode.commands.registerCommand('novaapi.open', function () {const panel = vscode.window.createWebviewPanel('novaapi', 'NovaAPI Dashboard', vscode.ViewColumn.One,{ enableScripts: true, retainContextWhenHidden: true });panel.webview.html = fs.readFileSync(path.join(context.extensionPath, 'index.html'), 'utf8');});context.subscriptions.push(disposable);}exports.activate = activate;`.trim();
        zip.file('package.json', JSON.stringify(packageJson, null, 2));
        zip.file('extension.js', extensionJs);
      }
      setProgress(80);
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `novaapi-${activeTab}-bundle.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setProgress(100);
      setTimeout(() => { setDeploying(false); onClose(); }, 1000);
    } catch (err: any) {
      setError(err.message || 'Deployment failed');
      setDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className={`border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-in ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className={`px-6 py-4 border-b flex justify-between items-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
          <div className="flex items-center gap-3">
            <i className="fas fa-rocket text-blue-500 text-lg"></i>
            <h2 className={`text-sm font-bold uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-800'}`}>Deploy Extensions</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 transition-colors"><i className="fas fa-times"></i></button>
        </div>
        <div className="p-6">
          <div className={`flex rounded-lg p-1 mb-6 border ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
            {(['chrome', 'vscode'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center gap-2 ${activeTab === tab ? (tab === 'chrome' ? 'bg-blue-600 text-white shadow-lg' : 'bg-indigo-600 text-white shadow-lg') : 'text-slate-500 hover:text-slate-800'}`}>
                <i className={tab === 'chrome' ? "fab fa-chrome" : "fas fa-code"}></i> {tab}
              </button>
            ))}
          </div>
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Version</label>
              <input type="text" value={metadata.version} onChange={(e) => setMetadata({ ...metadata, version: e.target.value })} className={`w-full border rounded px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-blue-400' : 'bg-white border-slate-200 text-slate-800'}`} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Author</label>
              <input type="text" value={metadata.author} onChange={(e) => setMetadata({ ...metadata, author: e.target.value })} className={`w-full border rounded px-3 py-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'bg-slate-950 border-slate-800 text-blue-400' : 'bg-white border-slate-200 text-slate-800'}`} />
            </div>
          </div>
          {deploying ? (
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-4"><div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }}></div></div>
          ) : (
            <button onClick={handleDeploy} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-lg text-xs font-black uppercase tracking-widest shadow-xl transition-all">Bundle & Deploy</button>
          )}
        </div>
      </div>
    </div>
  );
};