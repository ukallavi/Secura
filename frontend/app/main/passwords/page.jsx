'use client';

import { useState, useEffect } from 'react';
import { ENDPOINTS, fetchWithCSRF } from '@/lib/api-config';
import Loading from '@/components/loading';
import ErrorMessage from '@/components/error-message';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Search, Copy, MoreVertical, Eye, Trash2, Edit, Plus } from 'lucide-react';
import Link from 'next/link';

export default function PasswordsPage() {
  const [passwords, setPasswords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  // Fetch passwords from API
  useEffect(() => {
    const fetchPasswords = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${ENDPOINTS.PASSWORDS}?page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}`, {
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch passwords');
        }
        
        const data = await response.json();
        setPasswords(data.passwords || []);
        setTotalPages(Math.ceil(data.total / itemsPerPage) || 1);
        setError(null);
      } catch (err) {
        setError(err.message || 'An error occurred while fetching passwords');
        setPasswords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPasswords();
  }, [currentPage, searchQuery]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    
    toast({
      title: "Password copied",
      description: "Password copied to clipboard. It will be cleared in 10 seconds.",
    });
    
    // Auto-clear clipboard after 10 seconds for security
    setTimeout(() => {
      navigator.clipboard.writeText('');
    }, 10000);
  };

  const deletePassword = async (id) => {
    try {
      const response = await fetchWithCSRF(`${ENDPOINTS.PASSWORDS}/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete password');
      }
      
      // Remove from state
      setPasswords(passwords.filter(pwd => pwd.id !== id));
      
      toast({
        title: "Password deleted",
        description: "The password has been deleted successfully.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to delete password",
      });
    }
  };

  // Filter passwords based on search query
  const filteredPasswords = passwords;

  if (loading) return <Loading />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Stored Passwords</CardTitle>
            <CardDescription>
              Manage your stored account passwords
            </CardDescription>
          </div>
          <Link href="/main/generator" passHref>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search accounts..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {filteredPasswords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No passwords found. Add your first password using the generator.</p>
              <Link href="/main/generator" passHref>
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Password
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Username/Email</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPasswords.map((password) => (
                    <TableRow key={password.id}>
                      <TableCell className="font-medium">{password.accountName}</TableCell>
                      <TableCell>{password.username}</TableCell>
                      <TableCell>{new Date(password.updatedAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyToClipboard(password.password)}>
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Copy Password</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyToClipboard(password.username)}>
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Copy Username</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Link href={`/main/passwords/edit/${password.id}`} className="flex items-center w-full">
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Edit</span>
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-red-600"
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this password?')) {
                                  deletePassword(password.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              <div className="flex items-center justify-between space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}