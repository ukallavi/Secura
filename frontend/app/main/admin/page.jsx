'use client';

import { useState, useEffect } from 'react';
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
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, MoreVertical, UserPlus, Trash2, Shield, User, UserCog, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    // Check if user is admin
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      if (user.role !== 'admin') {
        toast({
          variant: "destructive",
          title: "Access denied",
          description: "You don't have permission to access this page.",
        });
        router.push('/dashboard');
      }
    }
    
    // Simulate loading data
    const loadData = async () => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock data
      const mockUsers = [
        { 
          id: 1, 
          email: 'admin@example.com', 
          role: 'admin',
          twoFactorEnabled: true,
          lastLogin: '2023-12-25T14:30:00',
          createdAt: '2023-01-15T10:00:00'
        },
        { 
          id: 2, 
          email: 'user1@example.com', 
          role: 'user',
          twoFactorEnabled: true,
          lastLogin: '2023-12-24T09:15:00',
          createdAt: '2023-03-22T11:30:00'
        },
        { 
          id: 3, 
          email: 'user2@example.com', 
          role: 'user',
          twoFactorEnabled: false,
          lastLogin: '2023-12-20T16:45:00',
          createdAt: '2023-05-10T14:20:00'
        },
        { 
          id: 4, 
          email: 'manager@example.com', 
          role: 'user',
          twoFactorEnabled: true,
          lastLogin: '2023-12-22T11:10:00',
          createdAt: '2023-06-05T09:45:00'
        },
        { 
          id: 5, 
          email: 'support@example.com', 
          role: 'user',
          twoFactorEnabled: false,
          lastLogin: '2023-12-18T13:30:00',
          createdAt: '2023-08-12T16:15:00'
        }
      ];
      
      setUsers(mockUsers);
      setFilteredUsers(mockUsers);
      setLoading(false);
    };
    
    loadData();
  }, [router, toast]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const handleAddUser = () => {
    if (!newUserEmail || !newUserEmail.includes('@')) {
      toast({
        variant: "destructive",
        title: "Invalid email",
        description: "Please enter a valid email address.",
      });
      return;
    }
    
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const newUser = {
        id: users.length + 1,
        email: newUserEmail,
        role: 'user',
        twoFactorEnabled: false,
        lastLogin: null,
        createdAt: new Date().toISOString()
      };
      
      const updatedUsers = [...users, newUser];
      setUsers(updatedUsers);
      setFilteredUsers(updatedUsers);
      
      setLoading(false);
      setIsDialogOpen(false);
      setNewUserEmail('');
      
      toast({
        title: "User added",
        description: `User ${newUserEmail} has been added successfully.`,
      });
    }, 1000);
  };

  const handleDeleteUser = (id) => {
    // Prevent deleting the admin user
    const userToDelete = users.find(user => user.id === id);
    if (userToDelete.email === 'admin@example.com') {
      toast({
        variant: "destructive",
        title: "Cannot delete admin",
        description: "The primary admin account cannot be deleted.",
      });
      return;
    }
    
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const updatedUsers = users.filter(user => user.id !== id);
      setUsers(updatedUsers);
      setFilteredUsers(updatedUsers.filter(user => 
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role.toLowerCase().includes(searchQuery.toLowerCase())
      ));
      
      setLoading(false);
      
      toast({
        title: "User deleted",
        description: "The user has been deleted successfully.",
      });
    }, 800);
  };

  const handleToggleRole = (id) => {
    // Prevent changing the admin user's role
    const userToUpdate = users.find(user => user.id === id);
    if (userToUpdate.email === 'admin@example.com') {
      toast({
        variant: "destructive",
        title: "Cannot change admin role",
        description: "The primary admin's role cannot be changed.",
      });
      return;
    }
    
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const updatedUsers = users.map(user => {
        if (user.id === id) {
          return {
            ...user,
            role: user.role === 'admin' ? 'user' : 'admin'
          };
        }
        return user;
      });
      
      setUsers(updatedUsers);
      setFilteredUsers(updatedUsers.filter(user => 
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role.toLowerCase().includes(searchQuery.toLowerCase())
      ));
      
      setLoading(false);
      
      toast({
        title: "Role updated",
        description: "The user's role has been updated successfully.",
      });
    }, 800);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Manage users and their permissions</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>
                Enter the email address for the new user. A temporary password will be generated.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddUser} disabled={loading}>
                {loading ? 'Adding...' : 'Add User'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>
            Manage user accounts and access permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading users...
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="hidden md:table-cell">2FA</TableHead>
                    <TableHead className="hidden md:table-cell">Last Login</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                          {user.role === 'admin' ? (
                            <div className="flex items-center">
                              <Shield className="mr-1 h-3 w-3" />
                              Admin
                            </div>
                          ) : (
                            <div className="flex items-center">
                              <User className="mr-1 h-3 w-3" />
                              User
                            </div>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {user.twoFactorEnabled ? (
                          <Badge variant="success" className="bg-green-100 text-green-800 hover:bg-green-100">Enabled</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-800">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center">
                          <Clock className="mr-1 h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{formatDate(user.lastLogin)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleToggleRole(user.id)}>
                              <UserCog className="mr-2 h-4 w-4" />
                              {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 border rounded-md">
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'No users match your search' : 'No users found'}
              </p>
              {searchQuery ? (
                <Button variant="outline" onClick={() => setSearchQuery('')}>
                  Clear Search
                </Button>
              ) : (
                <Button onClick={() => setIsDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Add Your First User
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>System Logs</CardTitle>
          <CardDescription>
            Recent activity and security events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border rounded-md p-4 flex items-start">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 flex-shrink-0">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">User Login</p>
                <p className="text-sm text-muted-foreground">
                  User admin@example.com logged in successfully
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Today at 2:30 PM • IP: 192.168.1.1
                </p>
              </div>
            </div>
            
            <div className="border rounded-md p-4 flex items-start">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mr-3 flex-shrink-0">
                <Shield className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="font-medium">Permission Change</p>
                <p className="text-sm text-muted-foreground">
                  User manager@example.com was promoted to admin role
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Yesterday at 11:45 AM • By: admin@example.com
                </p>
              </div>
            </div>
            
            <div className="border rounded-md p-4 flex items-start">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center mr-3 flex-shrink-0">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="font-medium">User Deleted</p>
                <p className="text-sm text-muted-foreground">
                  User test@example.com was deleted from the system
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Dec 20, 2023 at 9:15 AM • By: admin@example.com
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <Button variant="outline" className="w-full">
              View All Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}