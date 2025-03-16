import AdminRoute from '@/components/admin-route';
import Navbar from '@/components/navbar';
import AdminSidebar from '@/components/admin-sidebar';

export default function AdminLayout({ children }) {
  return (
    <AdminRoute>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex flex-1">
          <AdminSidebar />
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminRoute>
  );
}