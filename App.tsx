import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Settings, Film, List, Plus, Trash2, Download, AlertCircle, Play, Image as ImageIcon, CheckCircle, Loader2, Layers, Zap } from 'lucide-react';
import { AppSettings, GenerationTask, TaskStatus } from './types';
import { generateVideo } from './services/api';

// --- Components defined in file for simplicity, in a real app these would be split ---

// 1. Navbar
const Navbar: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const location = useLocation();
  
  const navClass = (path: string) => 
    `flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
      location.pathname === path 
        ? 'bg-primary text-white' 
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`;

  return (
    <nav className="flex items-center justify-between p-4 bg-card border-b border-slate-700 sticky top-0 z-50">
      <div className="flex items-center space-x-2">
        <div className="bg-gradient-to-tr from-primary to-purple-500 p-2 rounded-lg">
          <Film className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 hidden sm:inline-block">
          SoraGen 创作台
        </span>
      </div>
      
      <div className="flex items-center space-x-2 sm:space-x-4">
        <Link to="/" className={navClass('/')}>
          <List className="w-5 h-5" />
          <span className="hidden sm:inline">任务列表</span>
        </Link>
        <Link to="/gallery" className={navClass('/gallery')}>
          <Film className="w-5 h-5" />
          <span className="hidden sm:inline">视频画廊</span>
        </Link>
      </div>

      <button 
        onClick={onOpenSettings}
        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
        title="设置"
      >
        <Settings className="w-6 h-6" />
      </button>
    </nav>
  );
};

// 2. Settings Modal
const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
}> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-white">全局设置</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">接口地址 (API URL)</label>
              <input 
                type="text" 
                value={localSettings.apiUrl}
                onChange={(e) => setLocalSettings({...localSettings, apiUrl: e.target.value})}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://mj.do/v1/chat/completions"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">认证密钥 (Authorization)</label>
              <input 
                type="password" 
                value={localSettings.apiKey}
                onChange={(e) => setLocalSettings({...localSettings, apiKey: e.target.value})}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="sk-..."
              />
            </div>
          </div>
        </div>
        
        <div className="bg-slate-900 px-6 py-4 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white">取消</button>
          <button 
            onClick={() => { onSave(localSettings); onClose(); }}
            className="px-6 py-2 bg-primary hover:bg-secondary text-white rounded-lg font-medium transition-colors"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
};

// 3. Task List Page (Generator)
const TaskPage: React.FC<{
  settings: AppSettings;
  tasks: GenerationTask[];
  addTasks: (t: GenerationTask[]) => void;
  updateTask: (id: string, updates: Partial<GenerationTask>) => void;
  deleteTask: (id: string) => void;
}> = ({ settings, tasks, addTasks, updateTask, deleteTask }) => {
  const [prefix, setPrefix] = useState('');
  const [prompt, setPrompt] = useState('');
  const [suffix, setSuffix] = useState('');
  const [batchCount, setBatchCount] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmission = async () => {
    if (!prompt.trim()) return;

    const fullPrompt = [prefix, prompt, suffix].filter(Boolean).join(' ');
    
    // Create N task objects locally first
    const newTasks: GenerationTask[] = [];
    const count = Math.max(1, Math.min(10, batchCount)); // Limit between 1 and 10

    for (let i = 0; i < count; i++) {
      const taskId = crypto.randomUUID();
      newTasks.push({
        id: taskId,
        createdAt: Date.now(), // Tiny offset to keep order could be added, but not strictly necessary
        prefix,
        prompt,
        suffix,
        padImageBase64: selectedImage || undefined,
        status: TaskStatus.PROCESSING,
      });
    }

    // 1. Update UI immediately (Optimistic update)
    addTasks(newTasks);

    // 2. Fire off requests in background without awaiting them here
    // This ensures the UI doesn't block
    newTasks.forEach(task => {
      generateVideo(settings, fullPrompt, selectedImage || undefined)
        .then(videoUrl => {
          updateTask(task.id, { status: TaskStatus.SUCCESS, videoUrl });
        })
        .catch(error => {
          updateTask(task.id, { status: TaskStatus.FAILED, errorMsg: error.message || '未知错误' });
        });
    });

    // Optional: Clear fields? 
    // Keeping prompt makes it easier to "roll" again (Gacha style), so we only clear nothing or show a toast.
  };

  // Helper for translating status
  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.PENDING: return '等待中';
      case TaskStatus.PROCESSING: return '生成中';
      case TaskStatus.SUCCESS: return '完成';
      case TaskStatus.FAILED: return '失败';
      default: return status;
    }
  };

  // Sort tasks by newest first
  const sortedTasks = [...tasks].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-8 pb-20">
      {/* Input Section */}
      <div className="bg-card border border-slate-700 rounded-2xl p-6 shadow-xl">
        <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
          <Plus className="w-5 h-5 text-primary" />
          <span>新建生成任务</span>
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1 block">前缀 (风格/场景)</label>
            <input 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
              placeholder="例如: 动漫风格, 古代玄幻..."
              value={prefix}
              onChange={e => setPrefix(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1 block">后缀 (画质/运镜)</label>
            <input 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
              placeholder="例如: (4k, 8k), 穿梭飞行..."
              value={suffix}
              onChange={e => setSuffix(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1 block">提示词 (正文)</label>
          <textarea 
            className="w-full h-32 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary outline-none resize-none"
            placeholder="描述场景、人物、动作..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
           <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1 block">参考垫图</label>
            <div className="flex items-center space-x-4">
              <label className="flex items-center justify-center px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                  <ImageIcon className="w-4 h-4 mr-2" />
                  <span className="text-sm">上传图片</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
              </label>
              {selectedImage && (
                  <div className="relative group">
                    <img src={selectedImage} alt="Reference" className="h-12 w-12 object-cover rounded-md border border-slate-600" />
                    <button 
                      onClick={() => setSelectedImage(null)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
              )}
            </div>
           </div>
           
           <div>
            <label className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-1 block">批量生成数量 (抽卡)</label>
            <div className="flex items-center space-x-2">
              <div className="relative w-full">
                <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="number" 
                  min="1" 
                  max="10" 
                  value={batchCount}
                  onChange={e => setBatchCount(parseInt(e.target.value) || 1)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>
           </div>
        </div>

        <button 
          onClick={handleSubmission}
          disabled={!prompt.trim()}
          className="w-full py-3 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20 flex items-center justify-center space-x-2 active:scale-[0.98]"
        >
          <Zap className="w-5 h-5 fill-current" /> <span>立即生成 ({batchCount} 个任务)</span>
        </button>
      </div>

      {/* List Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-400 border-b border-slate-700 pb-2">最近任务列表</h3>
        {sortedTasks.length === 0 && (
          <div className="text-center py-10 text-slate-500">
            暂无任务，开始创建你的第一个视频吧！
          </div>
        )}
        {sortedTasks.map(task => (
          <div key={task.id} className="bg-card border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row gap-4 transition-all hover:border-slate-600">
            {/* Status Indicator / Thumbnail */}
            <div className="flex-shrink-0 w-full sm:w-32 h-32 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden relative">
              {task.status === TaskStatus.PROCESSING && <Loader2 className="w-8 h-8 text-primary animate-spin" />}
              {task.status === TaskStatus.FAILED && <AlertCircle className="w-8 h-8 text-red-500" />}
              {task.status === TaskStatus.SUCCESS && task.videoUrl && (
                 <video src={task.videoUrl} className="w-full h-full object-cover" muted loop onMouseOver={e => e.currentTarget.play()} onMouseOut={e => e.currentTarget.pause()} />
              )}
               {task.status === TaskStatus.SUCCESS && !task.videoUrl && (
                 <CheckCircle className="w-8 h-8 text-green-500" />
              )}
            </div>

            {/* Content */}
            <div className="flex-grow min-w-0">
               <div className="flex justify-between items-start mb-2">
                 <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                   task.status === TaskStatus.SUCCESS ? 'bg-green-500/20 text-green-400' :
                   task.status === TaskStatus.FAILED ? 'bg-red-500/20 text-red-400' :
                   'bg-blue-500/20 text-blue-400'
                 }`}>
                   {getStatusLabel(task.status)}
                 </span>
                 <span className="text-xs text-slate-500">{new Date(task.createdAt).toLocaleString('zh-CN')}</span>
               </div>
               
               <p className="text-sm text-slate-300 line-clamp-2 mb-2 font-mono" title={task.prompt}>
                 {task.prompt}
               </p>
               
               {task.errorMsg && (
                 <p className="text-xs text-red-400 bg-red-900/10 p-2 rounded border border-red-900/20">
                   错误: {task.errorMsg}
                 </p>
               )}

               <div className="mt-2 flex items-center space-x-3">
                 {task.status === TaskStatus.SUCCESS && task.videoUrl && (
                   <a 
                    href={task.videoUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-xs text-primary hover:text-white transition-colors"
                   >
                     <Play className="w-3 h-3" /> <span>播放详情</span>
                   </a>
                 )}
                 <button 
                  onClick={() => deleteTask(task.id)}
                  className="flex items-center space-x-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
                 >
                   <Trash2 className="w-3 h-3" /> <span>删除</span>
                 </button>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 4. Video Gallery Page
const GalleryPage: React.FC<{ tasks: GenerationTask[] }> = ({ tasks }) => {
  const successfulTasks = tasks.filter(t => t.status === TaskStatus.SUCCESS && t.videoUrl).sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="max-w-7xl mx-auto p-4 pb-20">
       <h2 className="text-2xl font-bold mb-6 flex items-center space-x-2">
          <Film className="w-6 h-6 text-primary" />
          <span>视频库 ({successfulTasks.length})</span>
        </h2>

        {successfulTasks.length === 0 ? (
          <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-slate-700">
            <p className="text-slate-400">暂无生成的视频。</p>
            <Link to="/" className="text-primary hover:underline mt-2 inline-block">去创建</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {successfulTasks.map(task => (
              <div key={task.id} className="bg-card rounded-xl overflow-hidden border border-slate-700 shadow-lg group hover:border-primary/50 transition-all">
                <div className="aspect-video bg-black relative">
                  <video 
                    controls 
                    preload="metadata"
                    className="w-full h-full object-contain"
                    poster={task.padImageBase64} // Use pad image as poster if available
                  >
                    <source src={task.videoUrl} type="video/mp4" />
                  </video>
                </div>
                <div className="p-4">
                   <div className="mb-2 h-12 overflow-hidden">
                    <p className="text-xs text-slate-400 line-clamp-2">{task.prompt}</p>
                   </div>
                   <div className="flex justify-between items-center mt-2 border-t border-slate-700 pt-2">
                      <span className="text-xs text-slate-500">{new Date(task.createdAt).toLocaleDateString('zh-CN')}</span>
                      <a 
                        href={task.videoUrl} 
                        download 
                        target="_blank"
                        className="p-2 text-slate-400 hover:text-primary hover:bg-slate-800 rounded-full transition-colors"
                        title="打开/下载"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
};

// --- Main App Logic ---

const App: React.FC = () => {
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Default Settings
  const [settings, setSettings] = useState<AppSettings>({
    apiUrl: 'https://mj.do/v1/chat/completions',
    apiKey: 'sk-btLslcZGHzTJaMkpEZFmaq98uGttjJzUi2wrVwovMTii65Ko', // User provided default
  });

  // Load from LocalStorage
  useEffect(() => {
    const storedTasks = localStorage.getItem('sora_tasks');
    const storedSettings = localStorage.getItem('sora_settings');
    
    if (storedTasks) {
      try {
        setTasks(JSON.parse(storedTasks));
      } catch (e) {
        console.error("Failed to parse tasks", e);
      }
    }
    
    if (storedSettings) {
      try {
        setSettings(JSON.parse(storedSettings));
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  // Save to LocalStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('sora_tasks', JSON.stringify(tasks));
  }, [tasks]);

  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem('sora_settings', JSON.stringify(newSettings));
  };

  const addTasks = (newTasks: GenerationTask[]) => {
    setTasks(prev => [...newTasks, ...prev]);
  };

  const updateTask = (id: string, updates: Partial<GenerationTask>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTask = (id: string) => {
    if (confirm('确定要删除这个任务吗?')) {
      setTasks(prev => prev.filter(t => t.id !== id));
    }
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-dark text-slate-200 font-sans">
        <Navbar onOpenSettings={() => setIsSettingsOpen(true)} />
        
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSave={handleSaveSettings}
        />

        <main className="container mx-auto mt-6 px-2 sm:px-4">
          <Routes>
            <Route path="/" element={
              <TaskPage 
                settings={settings}
                tasks={tasks}
                addTasks={addTasks}
                updateTask={updateTask}
                deleteTask={deleteTask}
              />
            } />
            <Route path="/gallery" element={
              <GalleryPage tasks={tasks} />
            } />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;