"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { 
  Bell, 
  Settings, 
  User, 
  LogOut, 
  Menu,
  Shield,
  X
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <nav className="bg-primary text-primary-foreground shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/main/dashboard" className="flex-shrink-0 flex items-center">
              <Shield className="h-8 w-8 mr-2" />
              <span className="text-xl font-bold">Secura</span>
            </Link>
          </div>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/main/notifications" className="p-2 rounded-full hover:bg-primary-800 transition-colors">
              <Bell size={20} />
            </Link>
            <Link href="/main/settings" className="p-2 rounded-full hover:bg-primary-800 transition-colors">
              <Settings size={20} />
            </Link>
            
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center space-x-1 p-2 rounded-full hover:bg-primary-800 transition-colors">
                <User size={20} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="px-4 py-2">
                  <p className="text-sm font-medium">{user?.email || 'User'}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/main/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/main/settings">Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              className="p-2 rounded-md text-primary-foreground hover:bg-primary-800 focus:outline-none"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link 
              href="/main/dashboard"
              className="block px-3 py-2 rounded-md text-base font-medium hover:bg-primary-800"
            >
              Dashboard
            </Link>
            <Link 
              href="/main/passwords"
              className="block px-3 py-2 rounded-md text-base font-medium hover:bg-primary-800"
            >
              Passwords
            </Link>
            <Link 
              href="/main/notifications"
              className="block px-3 py-2 rounded-md text-base font-medium hover:bg-primary-800"
            >
              Notifications
            </Link>
            <Link 
              href="/main/settings"
              className="block px-3 py-2 rounded-md text-base font-medium hover:bg-primary-800"
            >
              Settings
            </Link>
            <Link 
              href="/main/profile"
              className="block px-3 py-2 rounded-md text-base font-medium hover:bg-primary-800"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-red-500 hover:bg-primary-800"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
