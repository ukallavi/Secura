import ProtectedRoute from '@/components/protected-route';
import Navbar from '@/components/navbar';
import Sidebar from '@/components/sidebar';

export default function MainLayout({ children }) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}