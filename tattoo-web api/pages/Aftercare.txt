
import React, { useState, useEffect } from 'react';
import { db } from '../services/mockBackend';
import { useApp } from '../App';
import { UserRole } from '../types';
import { Edit, Save, X, ShieldCheck } from 'lucide-react';

const Aftercare: React.FC = () => {
  const { user } = useApp();
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setIsLoading(true);
    const text = await db.getAftercareContent();
    setContent(text);
    setEditedContent(text);
    setIsLoading(false);
  };

  const handleSave = async () => {
    try {
        await db.saveAftercareContent(editedContent);
        setContent(editedContent);
        setIsEditing(false);
    } catch (e: any) {
        alert("儲存失敗: " + e.message);
    }
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      
      {/* Header Area */}
      <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-6">
        <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 flex items-center gap-3">
               <ShieldCheck className="text-primary" size={32} />
               刺青術後保養
            </h1>
            <p className="text-gray-400">您的紋身護理指南，確保作品完美復原。</p>
        </div>

        {/* Admin Edit Button */}
        {user?.role === UserRole.ADMIN && !isEditing && (
            <button 
                onClick={() => setIsEditing(true)}
                className="bg-gray-800 text-gray-300 px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-700 hover:text-white transition-colors"
            >
                <Edit size={18} /> 編輯內容
            </button>
        )}
      </div>

      {/* Content Area */}
      {isLoading ? (
          <div className="text-center py-20 text-gray-500">正在載入資訊...</div>
      ) : (
          <>
            {isEditing ? (
                <div className="bg-card p-6 rounded-xl border border-primary/30 shadow-2xl">
                    <label className="block text-sm text-primary font-bold mb-2">編輯文字內容</label>
                    <textarea 
                        value={editedContent}
                        onChange={(e) => setEditedContent(e.target.value)}
                        className="w-full h-[60vh] bg-dark border border-gray-700 rounded-lg p-4 text-white font-sans text-lg leading-relaxed focus:border-primary focus:outline-none resize-none"
                    />
                    <div className="flex gap-4 mt-6 justify-end">
                        <button 
                            onClick={handleCancel}
                            className="px-6 py-2 rounded-lg font-bold text-gray-400 hover:text-white"
                        >
                            取消
                        </button>
                        <button 
                            onClick={handleSave}
                            className="bg-primary text-black px-6 py-2 rounded-lg font-bold hover:bg-yellow-500 flex items-center gap-2"
                        >
                            <Save size={18} /> 儲存變更
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-card/50 p-6 md:p-10 rounded-2xl border border-white/5 shadow-lg">
                    <div className="prose prose-invert max-w-none">
                        {/* whitespace-pre-wrap preserves line breaks from the database */}
                        <p className="whitespace-pre-wrap text-gray-300 text-lg leading-loose font-light">
                            {content}
                        </p>
                    </div>
                </div>
            )}
          </>
      )}

      {/* Footer Note */}
      <div className="mt-12 text-center text-gray-500 text-sm">
        <p>如有任何問題，歡迎隨時透過 LINE 聯繫我們。</p>
      </div>
    </div>
  );
};

export default Aftercare;
