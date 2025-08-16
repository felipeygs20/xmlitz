'use client';

import { motion } from 'framer-motion';
import { 
  ChartBarIcon, 
  DocumentTextIcon, 
  CloudArrowDownIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline';
import clsx from 'clsx';

interface SidebarProps {
  activeSection: string;
  setActiveSection: (section: 'dashboard' | 'nfse' | 'downloads') => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const navigation = [
  {
    name: 'Dashboard',
    id: 'dashboard',
    icon: ChartBarIcon,
    description: 'Visão geral do sistema'
  },
  {
    name: 'NFSe',
    id: 'nfse',
    icon: DocumentTextIcon,
    description: 'Gestão de notas fiscais'
  },
  {
    name: 'Downloads',
    id: 'downloads',
    icon: CloudArrowDownIcon,
    description: 'Baixar XMLs'
  },
];

const secondaryNavigation = [
  {
    name: 'Configurações',
    id: 'settings',
    icon: Cog6ToothIcon,
  },
  {
    name: 'Ajuda',
    id: 'help',
    icon: QuestionMarkCircleIcon,
  },
];

export default function Sidebar({ activeSection, setActiveSection, isOpen, setIsOpen }: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0">
        <div className="flex flex-col flex-grow glass border-r border-white/20 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-6 py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="flex items-center"
            >
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center mr-3">
                <DocumentTextIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">XMLITZ</h1>
                <p className="text-sm text-gray-600">NFSe Manager</p>
              </div>
            </motion.div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 pb-4 space-y-2">
            {navigation.map((item, index) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => setActiveSection(item.id as any)}
                className={clsx(
                  'w-full group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300',
                  activeSection === item.id
                    ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-white/50 hover:text-primary-600'
                )}
              >
                <item.icon
                  className={clsx(
                    'mr-3 flex-shrink-0 h-5 w-5 transition-colors',
                    activeSection === item.id ? 'text-white' : 'text-gray-400 group-hover:text-primary-500'
                  )}
                />
                <div className="text-left">
                  <div className="font-medium">{item.name}</div>
                  <div className={clsx(
                    'text-xs',
                    activeSection === item.id ? 'text-white/80' : 'text-gray-500'
                  )}>
                    {item.description}
                  </div>
                </div>
              </motion.button>
            ))}
          </nav>

          {/* Secondary Navigation */}
          <div className="px-4 pb-6">
            <div className="border-t border-white/20 pt-4 space-y-2">
              {secondaryNavigation.map((item) => (
                <button
                  key={item.id}
                  className="w-full group flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-xl hover:bg-white/50 hover:text-primary-600 transition-all duration-300"
                >
                  <item.icon className="mr-3 flex-shrink-0 h-5 w-5 text-gray-400 group-hover:text-primary-500" />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar */}
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{ type: 'tween', duration: 0.3 }}
        className="lg:hidden fixed inset-y-0 left-0 z-50 w-72 glass border-r border-white/20"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0 px-6 py-8">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center mr-3">
                <DocumentTextIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">XMLITZ</h1>
                <p className="text-sm text-gray-600">NFSe Manager</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 pb-4 space-y-2">
            {navigation.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id as any);
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300',
                  activeSection === item.id
                    ? 'bg-gradient-to-r from-primary-500 to-secondary-500 text-white shadow-lg'
                    : 'text-gray-700 hover:bg-white/50 hover:text-primary-600'
                )}
              >
                <item.icon
                  className={clsx(
                    'mr-3 flex-shrink-0 h-5 w-5 transition-colors',
                    activeSection === item.id ? 'text-white' : 'text-gray-400 group-hover:text-primary-500'
                  )}
                />
                <div className="text-left">
                  <div className="font-medium">{item.name}</div>
                  <div className={clsx(
                    'text-xs',
                    activeSection === item.id ? 'text-white/80' : 'text-gray-500'
                  )}>
                    {item.description}
                  </div>
                </div>
              </button>
            ))}
          </nav>

          {/* Secondary Navigation */}
          <div className="px-4 pb-6">
            <div className="border-t border-white/20 pt-4 space-y-2">
              {secondaryNavigation.map((item) => (
                <button
                  key={item.id}
                  className="w-full group flex items-center px-4 py-2 text-sm font-medium text-gray-700 rounded-xl hover:bg-white/50 hover:text-primary-600 transition-all duration-300"
                >
                  <item.icon className="mr-3 flex-shrink-0 h-5 w-5 text-gray-400 group-hover:text-primary-500" />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
}
