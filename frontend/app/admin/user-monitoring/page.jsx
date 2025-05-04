// frontend/app/admin/user-monitoring/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ENDPOINTS, fetchWithCSRF } from '@/lib/api-config';
import { useAuth } from '@/context/AuthContext';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  IconButton
} from '@mui/material';
import { Search as SearchIcon, Refresh as RefreshIcon } from '@mui/icons-material';

export default function UserMonitoringPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [monitoringDialogOpen, setMonitoringDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [monitoringData, setMonitoringData] = useState({
    level: 'BASIC',
    reason: '',
    durationDays: 30
  });
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [monitoringError, setMonitoringError] = useState('');
  
  useEffect(() => {
    // Check if user is authenticated and admin
    if (!loading && isAuthenticated) {
      if (!user.isAdmin) {
        router.push('/');
      } else {
        fetchUsers();
      }
    } else if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [user, isAuthenticated, loading, router]);
  
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      
      const queryParams = new URLSearchParams();
      queryParams.append('page', pagination.page.toString());
      queryParams.append('limit', pagination.limit.toString());
      
      if (searchTerm) {
        queryParams.append('search', searchTerm);
      }
      
      const response = await fetchWithCSRF(`/api/admin/users?${queryParams.toString()}`);
      
      if (response.success) {
        setUsers(response.data);
        setPagination(response.pagination);
      } else {
        setError(response.message || 'Failed to fetch users');
      }
    } catch (error) {
      setError(error.message || 'An error occurred while fetching users');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (isAuthenticated && user?.isAdmin) {
      fetchUsers();
    }
  }, [pagination.page, pagination.limit, isAuthenticated, user]);
  
  const handlePageChange = (event, value) => {
    setPagination(prev => ({ ...prev, page: value }));
  };
  
  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
    fetchUsers();
  };
  
  const handleSearchKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleSearch();
    }
  };
  
  const handleOpenMonitoringDialog = (user) => {
    setSelectedUser(user);
    
    // Set initial monitoring data based on user's current monitoring status
    setMonitoringData({
      level: user.monitoring_level || 'BASIC',
      reason: '',
      durationDays: 30
    });
    
    setMonitoringError('');
    setMonitoringDialogOpen(true);
  };
  
  const handleMonitoringChange = (event) => {
    const { name, value } = event.target;
    setMonitoringData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSetMonitoring = async () => {
    if (!selectedUser) return;
    
    try {
      setMonitoringLoading(true);
      setMonitoringError('');
      
      const response = await fetchWithCSRF(ENDPOINTS.SET_USER_MONITORING(selectedUser.id), {
        method: 'POST',
        body: JSON.stringify(monitoringData)
      });
      
      if (response.success) {
        // Close dialog
        setMonitoringDialogOpen(false);
        // Refresh users
        fetchUsers();
      } else {
        setMonitoringError(response.message || 'Failed to update monitoring settings');
      }
    } catch (error) {
      setMonitoringError(error.message || 'An error occurred while updating monitoring settings');
    } finally {
      setMonitoringLoading(false);
    }
  };
  
  const getMonitoringLevelColor = (level) => {
    switch (level) {
      case 'ENHANCED':
        return 'error';
      case 'BASIC':
        return 'warning';
      case 'NONE':
      default:
        return 'success';
    }
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };
  
  if (loading && users.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        User Monitoring Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
        <TextField
          placeholder="Search by name, email, or ID"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleSearchKeyPress}
          size="small"
          sx={{ flexGrow: 1 }}
          InputProps={{
            endAdornment: (
              <IconButton size="small" onClick={handleSearch}>
                <SearchIcon />
              </IconButton>
            ),
          }}
        />
        
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchUsers}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Monitoring Level</TableCell>
              <TableCell>Monitoring Until</TableCell>
              <TableCell>Last Activity</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell>{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Chip
                      label={user.monitoring_level || 'NONE'}
                      color={getMonitoringLevelColor(user.monitoring_level)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{formatDate(user.monitoring_until)}</TableCell>
                  <TableCell>{user.last_activity ? formatDate(user.last_activity) : 'Never'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button 
                        size="small" 
                        variant="outlined"
                        onClick={() => router.push(`/admin/users/${user.id}/activities`)}
                      >
                        View Activities
                      </Button>
                      <Button 
                        size="small" 
                        variant="contained"
                        onClick={() => handleOpenMonitoringDialog(user)}
                      >
                        Set Monitoring
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
        <Pagination
          count={pagination.totalPages}
          page={pagination.page}
          onChange={handlePageChange}
          disabled={loading}
        />
      </Box>
      
      {/* Monitoring Settings Dialog */}
      <Dialog open={monitoringDialogOpen} onClose={() => setMonitoringDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set User Monitoring Level</DialogTitle>
        <DialogContent>
          {monitoringError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {monitoringError}
            </Alert>
          )}
          
          {selectedUser && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                User Information:
              </Typography>
              <Typography variant="body2" gutterBottom>
                Name: {selectedUser.name}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Email: {selectedUser.email}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Current Monitoring Level: {selectedUser.monitoring_level || 'NONE'}
              </Typography>
              <Typography variant="body2" gutterBottom sx={{ mb: 3 }}>
                Monitoring Until: {selectedUser.monitoring_until ? formatDate(selectedUser.monitoring_until) : 'N/A'}
              </Typography>
            </>
          )}
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Monitoring Level</InputLabel>
            <Select
              name="level"
              value={monitoringData.level}
              onChange={handleMonitoringChange}
              label="Monitoring Level"
            >
              <MenuItem value="NONE">None (Normal monitoring)</MenuItem>
              <MenuItem value="BASIC">Basic (Increased scrutiny)</MenuItem>
              <MenuItem value="ENHANCED">Enhanced (Strict verification)</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Duration</InputLabel>
            <Select
              name="durationDays"
              value={monitoringData.durationDays}
              onChange={handleMonitoringChange}
              label="Duration"
            >
              <MenuItem value={1}>1 day</MenuItem>
              <MenuItem value={7}>7 days</MenuItem>
              <MenuItem value={30}>30 days</MenuItem>
              <MenuItem value={90}>90 days</MenuItem>
              <MenuItem value={180}>180 days</MenuItem>
              <MenuItem value={365}>365 days</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            name="reason"
            label="Reason for Monitoring"
            multiline
            rows={3}
            fullWidth
            margin="normal"
            value={monitoringData.reason}
            onChange={handleMonitoringChange}
            placeholder="Provide a reason for setting or changing the monitoring level"
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMonitoringDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSetMonitoring} 
            variant="contained" 
            color="primary"
            disabled={monitoringLoading || !monitoringData.reason.trim()}
          >
            {monitoringLoading ? <CircularProgress size={24} /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}