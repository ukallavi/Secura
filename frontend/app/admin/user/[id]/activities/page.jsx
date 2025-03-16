// frontend/app/admin/user/[id]/activities/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
  Card,
  CardContent,
  Pagination,
  Chip,
  Alert,
  CircularProgress,
  Grid,
  IconButton,
  Tooltip,
  Divider,
  Tab,
  Tabs
} from '@mui/material';
import { 
  ArrowBack as ArrowBackIcon, 
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Shield as ShieldIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

export default function UserActivitiesPage() {
  const { user: currentUser, isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams();
  const userId = params.id;
  
  const [user, setUser] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  
  const [tabValue, setTabValue] = useState(0);
  
  useEffect(() => {
    // Check if user is authenticated and admin
    if (!loading && isAuthenticated) {
      if (!currentUser.isAdmin) {
        router.push('/');
      } else {
        fetchUserData();
        fetchUserActivities();
      }
    } else if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [currentUser, isAuthenticated, loading, router, userId]);
  
  const fetchUserData = async () => {
    try {
      const response = await fetchWithCSRF(`/api/admin/user/${userId}`);
      
      if (response.success) {
        setUser(response.data);
      } else {
        setError(response.message || 'Failed to fetch user data');
      }
    } catch (error) {
      setError(error.message || 'An error occurred while fetching user data');
    }
  };
  
  const fetchUserActivities = async () => {
    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams();
      queryParams.append('page', pagination.page.toString());
      queryParams.append('limit', pagination.limit.toString());
      
      // Filter by tab selection
      if (tabValue === 1) {
        queryParams.append('suspicious', 'true');
      }
      
      const response = await fetchWithCSRF(`${ENDPOINTS.USER_ACTIVITIES(userId)}?${queryParams.toString()}`);
      
      if (response.success) {
        setActivities(response.data);
        setPagination(response.pagination);
      } else {
        setError(response.message || 'Failed to fetch user activities');
      }
    } catch (error) {
      setError(error.message || 'An error occurred while fetching user activities');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (isAuthenticated && currentUser?.isAdmin && userId) {
      fetchUserActivities();
    }
  }, [pagination.page, pagination.limit, tabValue, isAuthenticated, currentUser, userId]);
  
  const handlePageChange = (event, value) => {
    setPagination(prev => ({ ...prev, page: value }));
  };
  
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };
  
  const handleMonitoringClick = () => {
    router.push(`/admin/user-monitoring?userId=${userId}`);
  };
  
  const formatActivityType = (type) => {
    return type.replace(/_/g, ' ');
  };
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };
  
  const getRiskLevelColor = (score) => {
    if (score >= 75) return 'error';
    if (score >= 50) return 'warning';
    if (score >= 25) return 'info';
    return 'success';
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
  
  if (loading && !user) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => router.push('/admin/user-monitoring')}
          sx={{ mr: 2 }}
        >
          Back to Users
        </Button>
        <Typography variant="h4">User Activities</Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {user && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  User Information
                </Typography>
                <Typography variant="body1">
                  <strong>Name:</strong> {user.name}
                </Typography>
                <Typography variant="body1">
                  <strong>Email:</strong> {user.email}
                </Typography>
                <Typography variant="body1">
                  <strong>ID:</strong> {user.id}
                </Typography>
                <Typography variant="body1">
                  <strong>Status:</strong> {user.active ? 'Active' : 'Inactive'}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Security Status
                </Typography>
                <Typography variant="body1">
                  <strong>Monitoring Level:</strong>{' '}
                  <Chip
                    label={user.monitoring_level || 'NONE'}
                    color={getMonitoringLevelColor(user.monitoring_level)}
                    size="small"
                  />
                </Typography>
                <Typography variant="body1">
                  <strong>Monitoring Until:</strong> {user.monitoring_until ? formatDate(user.monitoring_until) : 'N/A'}
                </Typography>
                <Typography variant="body1">
                  <strong>Last Login:</strong> {user.last_login ? formatDate(user.last_login) : 'Never'}
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<ShieldIcon />}
                    onClick={handleMonitoringClick}
                  >
                    Manage Monitoring
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="activity tabs">
          <Tab label="All Activities" id="tab-0" />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <WarningIcon fontSize="small" sx={{ mr: 0.5 }} />
                Suspicious Only
              </Box>
            } 
            id="tab-1" 
          />
        </Tabs>
      </Box>
      
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchUserActivities}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Activity</TableCell>
              <TableCell>Date & Time</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Device</TableCell>
              <TableCell>Risk Score</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No activities found
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>{formatActivityType(activity.activity_type)}</TableCell>
                  <TableCell>{formatDate(activity.created_at)}</TableCell>
                  <TableCell>{activity.ip_address}</TableCell>
                  <TableCell>{activity.location || 'Unknown'}</TableCell>
                  <TableCell>{activity.device_type || 'Unknown'}</TableCell>
                  <TableCell>
                    {activity.risk_score !== null && activity.risk_score !== undefined ? (
                      <Chip
                        label={activity.risk_score}
                        color={getRiskLevelColor(activity.risk_score)}
                        size="small"
                      />
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton 
                        size="small" 
                        onClick={() => router.push(`/admin/suspicious-activities?activityId=${activity.id}`)}
                      >
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
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
    </Box>
  );
}