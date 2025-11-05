import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bell, Settings, User as UserIcon, LogOut, Menu, X, Moon, Sun, Users, CreditCard, Home, Expand, Minimize } from 'lucide-react';
import NautixLogo from '../../assets/logo/NAUTIX.svg';
import { authService, userService } from '../api';
import type { User as AppUser } from '../api';

interface HeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  title = "AI Research Assistant",
  showBackButton = false,
  onBackClick
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState<AppUser | null>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);

  const handleLogout = () => {
    console.log('Logout button clicked - starting logout process');
    
    // Clear tokens immediately
    try {
      authService.clearTokens();
      window.location.href = 'https://nautixsuite.com';
      //console.log('✅ Tokens cleared successfully');
    } catch (error) {
      ///console.error('❌ Error clearing tokens:', error);
      window.location.href = 'https://nautixsuite.com';
    }
    
    // Close the user menu
    setIsUserMenuOpen(false);
    
    // Force redirect to home page
    console.log('🔄 Redirecting to home page');
    // window.location.href = '/';
    window.location.href = 'https://nautixsuite.com';
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    // Toggle dark mode class on document
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('darkMode', 'false');
    }
  };

  const handleMaximize = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Check for saved preference or system preference on mount
  React.useEffect(() => {
    // Check localStorage first
    const savedDarkMode = localStorage.getItem('darkMode');
    
    if (savedDarkMode !== null) {
      // Use saved preference
      const isDark = savedDarkMode === 'true';
      setIsDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else {
      // Check system preference
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(systemPrefersDark);
      if (systemPrefersDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('darkMode', 'true');
      }
    }
  }, []);

  // Load current user 
  React.useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        console.log('Fetching current user...');
        const response = await userService.getCurrentUser(controller.signal);
        console.log('User API Response:', response);
        console.log('User Data:', response.data);
        
        // Handle different response structures
        let userData: AppUser | null = null;
        if (response.data) {
          userData = response.data;
        } else if (response && typeof response === 'object' && 'userName' in response) {
          // If response itself is the user data, extract it properly
          userData = response as unknown as AppUser;
        }
        
        console.log('Processed User Data:', userData);
        setCurrentUser(userData);
      } catch (e: any) {
        console.error('Error fetching user:', e);
        if (e?.name === 'CanceledError' || e?.name === 'AbortError'|| e?.name === 'ApiError') return;
        setCurrentUser(null);
      }
    })();
    return () => {
      controller.abort();
    };
  }, []);
  const userID = currentUser?.userID || '';
  const userName = currentUser?.userName || '';
  const userEmail = currentUser?.email || '';
  const userInitials = (currentUser ? `${currentUser.userName?.[0] ?? ''}${currentUser.lastName?.[0] ?? ''}` : 'CM').toUpperCase() || 'CM';
  
  // Debug logging
  console.log('Current User State:', currentUser);
  console.log('User ID:', userID);
  console.log('User Name:', userName);
  console.log('User Email:', userEmail);

  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Left side - Logo and Navigation */}
          <div className="flex items-center space-x-4 min-w-0">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              {/* <Anchor className="w-8 h-8 text-blue-600" /> */}
              <img src={NautixLogo} alt="Nautix Logo" className="h-8 sm:h-10 md:h-12 w-auto" />
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 tracking-wide uppercase truncate">{currentUser?.coName}</span>
                <h1 className="text-lg sm:text-2xl font-extrabold text-blue-700 dark:text-blue-300 leading-tight truncate">{title}</h1>
              </div>
            </div>

            
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {/* Home Button */}
            <button 
              onClick={() => navigate('/')}
              className="ml-2 sm:ml-4 h-8 w-8 sm:h-10 sm:w-10 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Home"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="h-8 w-8 sm:h-10 sm:w-10 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={handleMaximize}
              className="h-8 w-8 sm:h-10 sm:w-10 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Expand className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            {/* Notifications */}
              <button
              className="h-8 w-8 sm:h-10 sm:w-10 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Notifications"
              >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 p-2 sm:p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors max-w-[60vw] sm:max-w-none"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-semibold">{userInitials}</span>
                </div>
                <span className="hidden md:block text-sm text-gray-700 dark:text-gray-300 truncate max-w-[30vw]">
                  {userName || 'User'}
                </span>
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 sm:w-56 max-w-[90vw] bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700">
                  <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white break-words">{currentUser?.designation}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 break-words">{currentUser?.coName}</p>
                    <p className="text-xs text-blue-500 dark:text-blue-400 break-all">{userEmail}</p>
                  </div>
                  <div className="border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 sm:p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        
      </div>

      {/* Click outside to close dropdowns */}
      {(isUserMenuOpen || isMobileMenuOpen) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setIsUserMenuOpen(false);
            setIsMobileMenuOpen(false);
          }}
        />
      )}
    </header>
  );
};
