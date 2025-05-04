import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import { ErrorHandlingProvider } from '@/contexts/ErrorHandlingContext';
import { ServiceWorkerProvider } from '@/contexts/ServiceWorkerContext';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Secura',
  description: 'Secure password management solution',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ServiceWorkerProvider>
          <ErrorHandlingProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </ErrorHandlingProvider>
        </ServiceWorkerProvider>
      </body>
    </html>
  );
}