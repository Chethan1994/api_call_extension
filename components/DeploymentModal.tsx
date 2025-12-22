
import React, { useState } from 'react';
import JSZip from 'jszip';

interface DeploymentModalProps {
  onClose: () => void;
  files: Record<string, string>;
}

export const DeploymentModal: React.FC<DeploymentModalProps> = ({ onClose, files }) => {
  const [activeTab, setActiveTab] = useState<'chrome' | 'vscode'>('chrome');
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
      
      // Step 1: Add core application files
      setProgress(30);
      Object.entries(files).forEach(([path, content]) => {
        // Skip extension-specific metadata that we might override
        if (!path.includes('manifest.json') && !path.includes('package.json')) {
          zip.file(path, content);
        }
      });

      if (activeTab === 'chrome') {
        setProgress(50);
        // Step 2: Prepare Manifest V3
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
        setProgress(50);
        // Step 2: Prepare package.json and extension.js for VS Code
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
        
        const extensionJs = `
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

function activate(context) {
    let disposable = vscode.commands.registerCommand('novaapi.open', function () {
        const panel = vscode.window.createWebviewPanel(
            'novaapi', 'NovaAPI Dashboard', vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
        );
        panel.webview.html = fs.readFileSync(path.join(context.extensionPath, 'index.html'), 'utf8');
    });
    context.subscriptions.push(disposable);
}
exports.activate = activate;
        `.trim();

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
      setTimeout(() => {
        setDeploying(false);
        onClose();
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Deployment failed');
      setDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-in">
        <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <i className="fas fa-rocket text-blue-500 text-lg"></i>
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">Deploy Extensions</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-6">
          <div className="flex bg-slate-950 rounded-lg p-1 mb-6 border border-slate-800">
            <button
              onClick={() => setActiveTab('chrome')}
              className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center gap-2 ${
                activeTab === 'chrome' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <i className="fab fa-chrome"></i> Chrome Web Store
            </button>
            <button
              onClick={() => setActiveTab('vscode')}
              className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center gap-2 ${
                activeTab === 'vscode' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <i className="fas fa-code"></i> VS Code Marketplace
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Package Version</label>
              <input
                type="text"
                value={metadata.version}
                onChange={(e) => setMetadata({ ...metadata, version: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-blue-400 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Author / Publisher</label>
              <input
                type="text"
                value={metadata.author}
                onChange={(e) => setMetadata({ ...metadata, author: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-blue-400 outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {deploying ? (
            <div className="space-y-4">
              <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-center text-[10px] text-slate-500 animate-pulse uppercase font-bold tracking-widest">
                {progress < 100 ? 'Generating Production Artifacts...' : 'Deployment Ready!'}
              </p>
            </div>
          ) : (
            <button
              onClick={handleDeploy}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-lg text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 transition-all active:scale-[0.98]"
            >
              Single-Click Bundle & Deploy
            </button>
          )}

          {error && <p className="mt-4 text-[10px] text-red-500 font-bold bg-red-500/10 p-2 rounded border border-red-500/20 text-center">{error}</p>}
        </div>

        <div className="px-6 py-4 bg-slate-950/50 text-[9px] text-slate-600 italic border-t border-slate-800 text-center">
          Note: Clicking "Deploy" packages the source into a format ready for store submission and triggers an automated download.
        </div>
      </div>
    </div>
  );
};
