'use client';

import { motion } from 'framer-motion';
import { 
  Bars3Icon, 
  BellIcon, 
  MagnifyingGlassIcon,
  UserCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useState } from 'react';

interface HeaderProps {
  activeSection: string;
  setSidebarOpen: (open: boolean) => void;
}

const sectionTitles = {
  dashboard: 'Dashboard',
  nfse: 'Gestão de NFSe',
  downloads: 'Downloads de XML',
};

export default function Header({ activeSection, setSidebarOpen }: HeaderProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simular refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  return (
    <header className="glass border-b border-white/20 lg:pl-72">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left side */}
        <div className="flex items-center">
          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-all duration-300"
            onClick={() => setSidebarOpen(true)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          {/* Page title */}
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="ml-4 lg:ml-0"
          >
            <h1 className="text-2xl font-bold text-gray-900">
              {sectionTitles[activeSection as keyof typeof sectionTitles]}
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              {activeSection === 'dashboard' && 'Visão geral do sistema e estatísticas'}
              {activeSection === 'nfse' && 'Consulte e gerencie suas notas fiscais'}
              {activeSection === 'downloads' && 'Baixe XMLs de NFSe automaticamente'}
            </p>
          </motion.div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="hidden md:block relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar NFSe..."
              className="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-xl bg-white/50 backdrop-blur-sm focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 transition-all duration-300"
            />
          </div>

          {/* Refresh button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-all duration-300 disabled:opacity-50"
          >
            <ArrowPathIcon 
              className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} 
            />
          </motion.button>

          {/* Notifications */}
          <div className="relative">
            <button className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-all duration-300">
              <BellIcon className="h-5 w-5" />
              {/* Notification badge */}
              <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white"></span>
            </button>
          </div>

          {/* User menu */}
          <div className="relative">
            <button className="flex items-center p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-all duration-300">
              <UserCircleIcon className="h-8 w-8" />
              <span className="hidden md:block ml-2 text-sm font-medium">
                Admin
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="px-6 py-2 border-t border-white/10">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2">
            <li>
              <div className="flex items-center">
                <span className="text-sm text-gray-500">XMLITZ</span>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <svg
                  className="flex-shrink-0 h-4 w-4 text-gray-400 mx-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-900">
                  {sectionTitles[activeSection as keyof typeof sectionTitles]}
                </span>
              </div>
            </li>
          </ol>
        </nav>
      </div>
    </header>
  );
}
