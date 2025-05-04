"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext } from 'react';
import AuthContext from '@/contexts/AuthContext';
import { 
  Home, 
  Key, 
  Shield, 
  Settings, 
  Users, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useContext(AuthContext);
  
  // Debug user state
  useEffect(() => {
    console.log('Sidebar user state updated:', user);
    // Also check session storage for comparison
    const roleFromSession = sessionStorage.getItem('userRole');
    console.log('Role from session storage:', roleFromSession);
  }, [user]);

  const isActive = (path) => {
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  // Define base navigation items (available to all users)
  let baseNavItems = [
    {
      name: 'Passwords',
      href: '/main/passwords',
      icon: Key
    },
    {
      name: 'Shared',
      href: '/main/shared',
      icon: Users
    },
    {
      name: 'Alerts',
      href: '/main/alerts',
      icon: AlertTriangle
    },
    {
      name: 'Security',
      href: '/main/security',
      icon: Shield
    },
    {
      name: 'Settings',
      href: '/main/settings',
      icon: Settings
    }
  ];
  
  // Define admin-only navigation items
  const adminNavItems = [
    {
      name: 'Admin',
      href: '/admin/dashboard',
      icon: Shield
    }
  ];
  
  // Start with base items
  let navItems = [...baseNavItems];
  
  // Get role from session storage as fallback
  const roleFromSession = typeof window !== 'undefined' ? sessionStorage.getItem('userRole') : null;
  
  // Add admin items if user has admin role (check both context and session storage)
  const isAdmin = user?.role === 'admin' || roleFromSession === 'admin';
  
  if (isAdmin) {
    console.log('User has admin role, adding admin navigation items');
    navItems = [...adminNavItems, ...navItems];
  } else {
    console.log('User does not have admin role. Context user:', user);
    console.log('Role from session:', roleFromSession);
  }

  return (
    <aside 
      className={`bg-muted h-full transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        <div className="p-4 flex justify-end">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-full hover:bg-muted-foreground/20"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted-foreground/10'
                }`}
              >
                <Icon className="h-5 w-5" />
                {!collapsed && <span className="ml-3">{item.name}</span>}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
