
import React, { useState } from 'react';
import { useApp } from '../App';
import { UserRole, ADMIN_CREDENTIALS } from '../types';
import { useNavigate } from 'react-router-dom';
import { MOCK_LINE_USER } from '../constants'; // Fallback for dev

const Login: React.FC = () => {
  const { login, user } = useApp();
  const navigate = useNavigate();
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Redirect based on Role
  React.useEffect(() => {
    if (user) {
      if (user.role === UserRole.ADMIN) {
        navigate('/admin'); // 如果是管理員，直接去後台
      } else {
        navigate('/'); // 如果是一般人，回首頁
      }
    }
  }, [user, navigate]);

  const handleLineLogin = () => {
    // Determine if we should use real LINE Login or Mock (if LIFF ID is missing)
    // For now, we call login with UserRole.MEMBER. 
    // The App.tsx logic handles calling lineService.login().
    login(UserRole.MEMBER);
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
      login(UserRole.ADMIN);
    } else {
      setError('帳號或密碼錯誤');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card p-8 rounded-2xl shadow-2xl border border-white/5">
        
        <h2 className="text-2xl font-bold text-center mb-8 text-white">
          {isAdminMode ? '管理員登入' : '會員登入'}
        </h2>

        {!isAdminMode ? (
          <div className="space-y-6">
            <p className="text-center text-gray-400 text-sm">
                請使用 LINE 登入以查看價格與預約。
            </p>
            <button
              onClick={handleLineLogin}
              className="w-full bg-[#06c755] hover:bg-[#05b34c] text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors shadow-lg shadow-green-900/20"
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/41/LINE_logo.svg" className="w-6 h-6 mr-2 filter invert brightness-0 grayscale-0" alt="LINE" />
              使用 LINE 登入
            </button>
            
            <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-card text-gray-500">員工專用</span>
                </div>
            </div>

            <button
              onClick={() => setIsAdminMode(true)}
              className="w-full border border-gray-600 text-gray-400 hover:text-white hover:border-white py-2 rounded-lg text-sm transition-colors"
            >
              切換管理員登入
            </button>
          </div>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                placeholder="admin@inkflow.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">密碼</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-dark border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-primary"
                placeholder="admin"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <button
              type="submit"
              className="w-full bg-primary text-black font-bold py-3 rounded-lg hover:bg-yellow-500 transition-colors"
            >
              進入後台
            </button>
             <button
              type="button"
              onClick={() => setIsAdminMode(false)}
              className="w-full text-gray-500 text-xs hover:text-white mt-4"
            >
              返回會員登入
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Login;
