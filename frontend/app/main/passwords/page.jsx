'use client';

import { useState, useEffect } from 'react';
import { ENDPOINTS } from '@/lib/api-config';
// Add CSRF_TOKEN endpoint if it doesn't exist
if (!ENDPOINTS.CSRF_TOKEN) {
  ENDPOINTS.CSRF_TOKEN = process.env.NEXT_PUBLIC_API_URL ? `${process.env.NEXT_PUBLIC_API_URL}/csrf-token` : 'http://localhost:5000/api/csrf-token';
}
import Loading from '@/components/loading';
import ErrorMessage from '@/components/error-message';
import { decryptData, getEncryptionKey } from '@/lib/encryption';
import { ExportPasswordsDialog } from '@/components/passwords/export-dialog';
import { ImportPasswordsDialog } from '@/components/passwords/import-dialog';
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
  const [decryptedPasswords, setDecryptedPasswords] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [encryptionError, setEncryptionError] = useState(null);
  const itemsPerPage = 10;

  // Function to decrypt a password
  const decryptPassword = async (encryptedPassword) => {
    try {
      // Get the encryption key from memory
      const encryptionKey = getEncryptionKey();
      
      if (!encryptionKey) {
        throw new Error('Encryption key not found. Please log in again.');
      }
      
      // Check if the password is actually encrypted (should be a JSON string)
      if (typeof encryptedPassword !== 'string' || !encryptedPassword.startsWith('{')) {
        // If not encrypted, return as is (for backward compatibility)
        return encryptedPassword;
      }
      
      // Decrypt the password
      const decryptedPassword = await decryptData(encryptedPassword, encryptionKey);
      return decryptedPassword;
    } catch (err) {
      console.error('Error decrypting password:', err);
      setEncryptionError(err.message || 'Failed to decrypt password');
      return '••••••••'; // Return placeholder for failed decryption
    }
  };

  // Fetch passwords from API
  useEffect(() => {
    const fetchPasswords = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Get CSRF token first
        const csrfResponse = await fetch(`${ENDPOINTS.CSRF_TOKEN}`, {
          credentials: 'include',
        });
        
        if (!csrfResponse.ok) {
          throw new Error('Failed to get CSRF token');
        }
        
        const csrfData = await csrfResponse.json();
        const csrfToken = csrfData.token || csrfData.csrfToken;
        
        // Use fetch with CSRF token to get the passwords
        const response = await fetch(`${ENDPOINTS.PASSWORDS}?page=${currentPage}&limit=${itemsPerPage}&search=${searchQuery}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          credentials: 'include'
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch passwords');
        }
        
        const data = await response.json();
        
        // Handle empty data gracefully
        if (!data || !Array.isArray(data.passwords)) {
          setPasswords([]);
          setTotalPages(1);
          setLoading(false);
          return;
        }
        
        // Log the structure of the first password object to debug
        if (data.passwords.length > 0) {
          console.log('Password object structure:', Object.keys(data.passwords[0]));
        }
        
        setPasswords(data.passwords);
        setTotalPages(Math.ceil(data.total / itemsPerPage) || 1);
        
        // Decrypt passwords
        const decrypted = {};
        for (const pwd of data.passwords) {
          try {
            // Only decrypt if we have an encryption key
            if (getEncryptionKey()) {
              // Use password_encrypted if it exists, otherwise try password
              const encryptedPassword = pwd.password_encrypted || pwd.password;
              if (encryptedPassword) {
                decrypted[pwd.id] = await decryptPassword(encryptedPassword);
              }
            }
          } catch (decryptError) {
            console.error(`Failed to decrypt password ${pwd.id}:`, decryptError);
          }
        }
        
        setDecryptedPasswords(decrypted);
      } catch (err) {
        console.error('Error fetching passwords:', err);
        setError(err.message || 'An error occurred while fetching passwords');
        setPasswords([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPasswords();
  }, [currentPage, searchQuery]);

  const copyToClipboard = async (passwordObj, isUsername = false) => {
    let textToCopy;
    
    if (isUsername) {
      // Use username or email, with fallback
      textToCopy = passwordObj.username || passwordObj.email || '';
    } else {
      try {
        // Use the already decrypted password if available
        if (decryptedPasswords[passwordObj.id]) {
          textToCopy = decryptedPasswords[passwordObj.id];
        } else {
          // Try to decrypt on-demand if not already decrypted
          const encryptedPassword = passwordObj.password_encrypted || passwordObj.password;
          if (encryptedPassword) {
            textToCopy = await decryptPassword(encryptedPassword);
            // Update the decrypted passwords cache
            setDecryptedPasswords(prev => ({
              ...prev,
              [passwordObj.id]: textToCopy
            }));
          } else {
            throw new Error('No password available');
          }
        }
      } catch (error) {
        console.error('Failed to copy password:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to copy password. Please try again.",
        });
        return;
      }
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(textToCopy);
    
    toast({
      title: isUsername ? "Username copied" : "Password copied",
      description: `${isUsername ? "Username" : "Password"} copied to clipboard. It will be cleared in 10 seconds.`,
    });
    
    // Auto-clear clipboard after 10 seconds for security
    setTimeout(() => {
      // Check if document is focused before attempting to clear clipboard
      if (document.hasFocus()) {
        navigator.clipboard.writeText('')
          .catch(err => {
            // Silently handle clipboard errors
            console.log('Clipboard could not be cleared automatically');
          });
      } else {
        console.log('Document not focused, skipping clipboard clear');
      }
    }, 10000);
  };

  const deletePassword = async (id) => {
    try {
      // Get CSRF token first
      const csrfResponse = await fetch(`${ENDPOINTS.CSRF_TOKEN}`, {
        credentials: 'include',
      });
      
      if (!csrfResponse.ok) {
        throw new Error('Failed to get CSRF token');
      }
      
      const csrfData = await csrfResponse.json();
      const csrfToken = csrfData.token || csrfData.csrfToken;
      
      // Now make the delete request with the CSRF token
      const response = await fetch(`${ENDPOINTS.PASSWORDS}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        },
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
          <div className="flex space-x-2">
            <ImportPasswordsDialog />
            <ExportPasswordsDialog />
            <Link href="/main/generator" passHref>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add New
              </Button>
            </Link>
          </div>
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
                      <TableCell className="font-medium">{password.title || password.accountName || password.account_name || 'Unnamed Account'}</TableCell>
                      <TableCell>{password.username || password.email || 'No username'}</TableCell>
                      <TableCell>{password.updated_at ? new Date(password.updated_at).toLocaleDateString() : 'Unknown'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => copyToClipboard(password, false)}>
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Copy Password</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyToClipboard(password, true)}>
                              <Copy className="mr-2 h-4 w-4" />
                              <span>Copy Username</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Link href={`/main/password/edit/${password.id}`} className="flex items-center w-full">
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