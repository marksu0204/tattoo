
import React, { useState, useEffect, createContext, useContext, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { User, UserRole } from './types';
import { Menu, X, Instagram, LogOut, User as UserIcon } from 'lucide-react';
import { lineService } from './services/lineService';
import { db } from './services/mockBackend';
import { BrandProvider, useBrand } from './context/BrandContext';
import {
  getFooterGalleryHint,
  getHeaderBrandLabel,
  shouldShowHeaderLogoImage,
} from './utils/brandPresentation';
import { getBrandInstagramUrl, hasBrandLoginCapability } from './utils/brandContact';
import { AdminBrandProvider } from './context/AdminBrandContext';
import UnsupportedBrand from './pages/UnsupportedBrand';
import LineEntryButton from './components/LineEntryButton';
import { CUSTOM_INQUIRY_MESSAGE } from './utils/contactInquiry';

// Lazy load pages to avoid circular dependencies
const Home = lazy(() => import('./pages/Home'));
const ArtworkDetail = lazy(() => import('./pages/ArtworkDetail'));
const AdminDashboardInner = lazy(() => import('./pages/AdminDashboard'));

const AdminDashboardPage: React.FC = () => (
  <AdminBrandProvider>
    <AdminDashboardInner />
  </AdminBrandProvider>
);
const Login = lazy(() => import('./pages/Login'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const Aftercare = lazy(() => import('./pages/Aftercare'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const TattooPreview = lazy(() => import('./pages/TattooPreview'));
const Tattoo3DPreviewTest = lazy(() => import('./pages/Tattoo3DPreviewTest'));
const ConsentForm = lazy(() => import('./pages/ConsentForm'));
const AppointmentView = lazy(() => import('./pages/AppointmentView'));
const NotFound = lazy(() => import('./pages/NotFound'));

// --- Global Context ---
interface AppContextType {
  user: User | null;
  login: (role: UserRole, mockData?: User, redirectPath?: string) => void;
  logout: () => void;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({} as AppContextType);
export const useApp = () => useContext(AppContext);

// --- Layout Component ---
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useApp();
  const { brand } = useBrand();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const instagramUrl = getBrandInstagramUrl(brand);
  const headerLabel = getHeaderBrandLabel(brand);
  const showHeaderLogo = shouldShowHeaderLogoImage(brand);
  const footerHint = getFooterGalleryHint(brand);
  const canMemberLogin = hasBrandLoginCapability(brand);
  // 後台不需要顧客用的 LINE 入口
  const showLineEntry = !location.pathname.startsWith('/admin');

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-dark text-gray-200" style={{ overscrollBehavior: 'none' }}>
      {/* 選單開啟時的半透明遮罩，點擊可關閉，同時阻擋下方元件穿透 */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-90 bg-black/40 md:hidden"
          onClick={() => setIsMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav className="sticky top-0 z-100 bg-dark/95 backdrop-blur-md border-b border-white/10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0 flex items-center gap-2">
              <Link to="/" className="text-2xl font-bold tracking-wider text-primary flex items-center gap-2">
                {showHeaderLogo && brand?.logoUrl ? (
                  <img src={brand.logoUrl} alt={headerLabel} className="h-8 w-auto max-w-[160px] object-contain" />
                ) : (
                  headerLabel
                )}
              </Link>
            </div>

            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <Link to="/" className="hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors">作品集</Link>
                <Link to="/preview" className="hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors">刺青預覽</Link>
                <Link to="/aftercare" className="hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors">保養須知</Link>
                {user && canMemberLogin && (
                    <Link to="/calendar" className="hover:text-primary px-3 py-2 rounded-md text-sm font-medium transition-colors">預約行事曆</Link>
                )}
                {user?.role === UserRole.ADMIN && (
                   <Link to="/admin" className="text-red-400 hover:text-red-300 px-3 py-2 rounded-md text-sm font-medium transition-colors">管理後台</Link>
                )}
              </div>
            </div>

            <div className="hidden md:flex items-center gap-4">
              {showLineEntry && <LineEntryButton placement="header" variant="pill" label="LINE 詢問" />}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-primary transition-colors">
                  <Instagram size={20} />
                </a>
              )}
              {user ? (
                <div className="flex items-center gap-3">
                  <Link 
                    to="/profile"
                    className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded-full transition-colors"
                  >
                    {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="avatar" className="w-6 h-6 rounded-full" />
                    ) : (
                        <UserIcon size={20} className="text-gray-400" />
                    )}
                    <span className="text-xs text-gray-400 hidden lg:inline">Hi, {user.name}</span>
                  </Link>
                  <button onClick={logout} className="p-1 hover:text-white text-gray-500"><LogOut size={20}/></button>
                </div>
              ) : canMemberLogin ? (
                <Link to="/login" className="text-sm text-gray-400 hover:text-white">登入</Link>
              ) : null}
            </div>

            <div className="-mr-2 flex items-center gap-2 md:hidden">
              {showLineEntry && <LineEntryButton placement="header" variant="pill" />}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="inline-flex items-center justify-center p-2 px-3 rounded-lg text-primary border border-primary/30 hover:bg-white/5 focus:outline-none gap-2 transition-all"
              >
                <span className="text-xs font-bold tracking-wide">MENU</span>
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden bg-card border-b border-white/10 animate-fade-in">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link to="/" className="text-gray-300 hover:text-primary block px-3 py-3 rounded-md text-base font-medium border-b border-white/5">作品集</Link>
              <Link to="/preview" className="text-gray-300 hover:text-primary block px-3 py-3 rounded-md text-base font-medium border-b border-white/5">刺青預覽</Link>
              <Link to="/aftercare" className="text-gray-300 hover:text-primary block px-3 py-3 rounded-md text-base font-medium border-b border-white/5">保養須知</Link>
              <LineEntryButton
                placement="custom_inquiry_menu"
                variant="menu"
                label="客製諮詢"
                message={CUSTOM_INQUIRY_MESSAGE}
                onClick={() => setIsMenuOpen(false)}
              />
              <LineEntryButton placement="menu" variant="menu" onClick={() => setIsMenuOpen(false)} />
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-gray-300 hover:text-primary flex items-center gap-2 px-3 py-3 rounded-md text-base font-medium border-b border-white/5"
                >
                  <Instagram size={18} /> Instagram
                </a>
              )}
              {user && canMemberLogin && (
                  <Link to="/calendar" className="text-gray-300 hover:text-primary block px-3 py-3 rounded-md text-base font-medium border-b border-white/5">預約行事曆</Link>
              )}
              {user?.role === UserRole.ADMIN && (
                   <Link to="/admin" className="text-red-400 block px-3 py-3 rounded-md text-base font-medium border-b border-white/5">管理後台</Link>
              )}
               {!user && canMemberLogin ? (
                  <Link to="/login" className="text-gray-300 hover:text-white block px-3 py-3 rounded-md text-base font-medium">登入</Link>
               ) : !user ? null : (
                 <>
                    <Link to="/profile" className="text-gray-300 hover:text-white block w-full text-left px-3 py-3 rounded-md text-base font-medium border-b border-white/5">
                        我的個人檔案與預約
                    </Link>
                    <button onClick={logout} className="text-gray-300 hover:text-white block w-full text-left px-3 py-3 rounded-md text-base font-medium">登出</button>
                 </>
               )}
            </div>
          </div>
        )}
      </nav>

      <main className="flex-grow">
        {children}
      </main>

      <footer className="bg-black py-8 border-t border-white/5 print:hidden" style={{ minHeight: '140px' }}>
        <div className="max-w-7xl mx-auto px-4 text-center">
            <h2 className="text-xl font-bold text-primary mb-2">{footerHint}</h2>
            <div className="flex justify-center gap-4 mb-4">
                {instagramUrl && (
                  <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white">
                    <Instagram size={24} />
                  </a>
                )}
            </div>
            <p className="text-xs text-gray-600">© 2026 InkFlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

// --- Main App Component (supported brand only) ---
const SupportedApp: React.FC = () => {
  const { brand, brandContextLoading } = useBrand();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const liffId = brand?.liffId ?? null;
  const publicOrigin = (brand?.publicOrigin ?? window.location.origin).replace(/\/$/, '');

  useEffect(() => {
    // Check local storage for persistent session
    const storedUser = localStorage.getItem('inkflow_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (brandContextLoading) return;

    const initLine = async () => {
      const lineUser = await lineService.init(liffId);
      if (!lineUser) return;

      const accessToken = lineService.getAccessToken();
      if (!accessToken) {
        console.warn('LINE access token missing — session invalid');
        lineService.logout();
        localStorage.removeItem('inkflow_user');
        return;
      }

      try {
        const synced = await db.syncUser(accessToken);
        setUser(synced);
        localStorage.setItem('inkflow_user', JSON.stringify(synced));
      } catch (e) {
        console.error('Sync failed', e);
        lineService.logout();
        setUser(null);
        localStorage.removeItem('inkflow_user');
      }
    };
    initLine();
  }, [liffId, brandContextLoading]);

  const login = (role: UserRole, mockData?: User, redirectPath?: string) => {
    if (role === UserRole.ADMIN) {
      const newUser: User = {
          id: 'admin',
          name: 'Admin',
          role: UserRole.ADMIN,
          favorites: []
      };
      setUser(newUser);
      localStorage.setItem('inkflow_user', JSON.stringify(newUser));
    } else {
      if (redirectPath) {
        const hashPath = redirectPath.startsWith('#')
          ? redirectPath
          : `#${redirectPath}`;
        const redirectUri = `${publicOrigin}/${hashPath}`;
        lineService.login(liffId, redirectUri);
      } else {
        lineService.login(liffId, `${publicOrigin}/login`);
      }
    }
  };

  const logout = () => {
    lineService.logout();
    setUser(null);
    localStorage.removeItem('inkflow_user');
  };

  const refreshUser = async () => {
    const accessToken = lineService.getAccessToken();
    if (!accessToken) {
      console.warn('LINE access token missing on refresh');
      return;
    }
    try {
      const synced = await db.syncUser(accessToken);
      setUser(synced);
      localStorage.setItem('inkflow_user', JSON.stringify(synced));
    } catch (e) {
      console.error('Refresh user failed', e);
      lineService.logout();
      setUser(null);
      localStorage.removeItem('inkflow_user');
    }
  };

  if (isLoading) return <div className="min-h-screen bg-dark flex items-center justify-center text-primary">Loading...</div>;

  return (
    <AppContext.Provider value={{ user, login, logout, isLoading, refreshUser }}>
      <Router>
        <Layout>
          <Suspense fallback={<div className="min-h-screen bg-dark flex items-center justify-center text-primary">Loading...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/artwork/:id" element={<ArtworkDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/aftercare" element={<Aftercare />} />
              <Route path="/preview" element={<TattooPreview />} />
              <Route path="/3d-preview-test" element={<Tattoo3DPreviewTest />} />
              <Route path="/consent" element={<ConsentForm />} />
              <Route path="/consent/:appointmentId" element={<ConsentForm />} />
              <Route path="/appointment" element={<AppointmentView />} />
              <Route path="/appointment/:appointmentId" element={<AppointmentView />} />
              
              {/* Protected User Routes */}
              <Route path="/calendar" element={ user ? <CalendarPage /> : <Navigate to="/login" /> } />
              <Route path="/profile" element={ user ? <UserProfile /> : <Navigate to="/login" /> } />
              
              {/* Protected Admin Routes */}
              <Route path="/admin" element={ user?.role === UserRole.ADMIN ? <AdminDashboardPage /> : <Navigate to="/login" /> } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </Layout>
      </Router>
    </AppContext.Provider>
  );
};

const BrandGateLoader: React.FC = () => (
  <div className="min-h-screen bg-dark flex items-center justify-center text-primary">
    Loading...
  </div>
);

const AppInner: React.FC = () => {
  const { isSupported, brandContextLoading } = useBrand();

  if (brandContextLoading) {
    return <BrandGateLoader />;
  }

  if (!isSupported) {
    return <UnsupportedBrand />;
  }

  return <SupportedApp />;
};

const App: React.FC = () => (
  <BrandProvider>
    <AppInner />
  </BrandProvider>
);

export default App;
