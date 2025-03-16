// frontend/app/admin/suspicious-activities/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ENDPOINTS, fetchWithCSRF, ErrorTypes } from '@/lib/api-config';
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
  IconButton,
  Tooltip,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { 
  FilterList as FilterIcon, 
  Refresh as RefreshIcon, 
  Info as InfoIcon, 
  Check as CheckIcon, 
  Close as CloseIcon, 
  Help as HelpIcon 
} from '@mui/icons-material';

export default function SuspiciousActivitiesPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  
  const [filters, setFilters] = useState({
    userId: '',
    activityType: '',
    minRiskScore: '',
    reviewed: '',
    startDate: '',
    endDate: ''
  });
  
  const [showFilters, setShowFilters] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewData, setReviewData] = useState({
    resolution: 'LEGITIMATE',
    notes: ''
  });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  useEffect(() => {
    // Check if user is authenticated and admin
    if (!loading && isAuthenticated) {
      if (!user.isAdmin) {
        router.push('/');
      } else {
        fetchActivities();
      }
    } else if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [user, isAuthenticated, loading, router]);
  
  const fetchActivities = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Build query string from filters
      const queryParams = new URLSearchParams();
      queryParams.append('page', pagination.page.toString());
      queryParams.append('limit', pagination.limit.toString());
      
      if (filters.userId) queryParams.append('userId', filters.userId);
      if (filters.activityType) queryParams.append('activityType', filters.activityType);
      if (filters.minRiskScore) queryParams.append('minRiskScore', filters.minRiskScore);
      if (filters.reviewed !== '') queryParams.append('reviewed', filters.reviewed);
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      
      const response = await fetchWithCSRF(`${ENDPOINTS.SUSPICIOUS_ACTIVITIES}?${queryParams.toString()}`);
      
      if (response.success) {
        setActivities(response.data);
        setPagination(response.pagination);
      } else {
        setError(response.message || 'Failed to fetch suspicious activities');
      }
    } catch (error) {
      setError(error.message || 'An error occurred while fetching suspicious activities');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (isAuthenticated && user?.isAdmin) {
      fetchActivities();
    }
  }, [pagination.page, pagination.limit, isAuthenticated, user]);
  
  const handlePageChange = (event, value) => {
    setPagination(prev => ({ ...prev, page: value }));
  };
  
  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const handleApplyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
    fetchActivities();
    setShowFilters(false);
  };
  
  const handleResetFilters = () => {
    setFilters({
      userId: '',
      activityType: '',
      minRiskScore: '',
      reviewed: '',
      startDate: '',
      endDate: ''
    });
  };
  
  const handleOpenReview = (activity) => {
    setSelectedActivity(activity);
    setReviewData({
      resolution: 'LEGITIMATE',
      notes: ''
    });
    setReviewError('');
    setReviewDialogOpen(true);
  };
  
  const handleReviewChange = (event) => {
    const { name, value } = event.target;
    setReviewData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmitReview = async () => {
    if (!selectedActivity) return;
    
    try {
      setReviewLoading(true);
      setReviewError('');
      
      const response = await fetchWithCSRF(ENDPOINTS.REVIEW_ACTIVITY(selectedActivity.id), {
        method: 'POST',
        body: JSON.stringify(reviewData)
      });
      
      if (response.success) {
        // Close dialog
        setReviewDialogOpen(false);
        // Refresh activities
        fetchActivities();
      } else {
        setReviewError(response.message || 'Failed to submit review');
      }
    } catch (error) {
      setReviewError(error.message || 'An error occurred while submitting review');
    } finally {
      setReviewLoading(false);
    }
  };
  
  const handleViewDetails = (activity) => {
    setSelectedActivity(activity);
    setDetailsDialogOpen(true);
  };
  
  const getRiskLevelColor = (score) => {
    if (score >= 75) return 'error';
    if (score >= 50) return 'warning';
    if (score >= 25) return 'info';
    return 'success';
  };
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };
  
  const formatActivityType = (type) => {
    return type.replace(/_/g, ' ');
  };
  
  if (loading && activities.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Suspicious Activities
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button
          variant="outlined"
          startIcon={<FilterIcon />}
          onClick={() => setShowFilters(!showFilters)}
        >
          Filters
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchActivities}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>
      
      {showFilters && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                name="userId"
                label="User ID"
                fullWidth
                value={filters.userId}
                onChange={handleFilterChange}
                type="number"
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Activity Type</InputLabel>
                <Select
                  name="activityType"
                  value={filters.activityType}
                  onChange={handleFilterChange}
                  label="Activity Type"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="LOGIN_FAILED">Login Failed</MenuItem>
                  <MenuItem value="LOGIN_SUCCESS">Login Success</MenuItem>
                  <MenuItem value="PASSWORD_CHANGE">Password Change</MenuItem>
                  <MenuItem value="PASSWORD_RESET">Password Reset</MenuItem>
                  <MenuItem value="PROFILE_UPDATE">Profile Update</MenuItem>
                  <MenuItem value="ACCOUNT_RECOVERY">Account Recovery</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                name="minRiskScore"
                label="Min Risk Score"
                fullWidth
                value={filters.minRiskScore}
                onChange={handleFilterChange}
                type="number"
                inputProps={{ min: 0, max: 100 }}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Review Status</InputLabel>
                <Select
                  name="reviewed"
                  value={filters.reviewed}
                  onChange={handleFilterChange}
                  label="Review Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Reviewed</MenuItem>
                  <MenuItem value="false">Not Reviewed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                name="startDate"
                label="Start Date"
                type="date"
                fullWidth
                value={filters.startDate}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                name="endDate"
                label="End Date"
                type="date"
                fullWidth
                value={filters.endDate}
                onChange={handleFilterChange}
                InputLabelProps={{ shrink: true }}
                size="small"
              />
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={handleResetFilters}>
              Reset
            </Button>
            <Button variant="contained" onClick={handleApplyFilters} disabled={loading}>
              Apply Filters
            </Button>
          </Box>
        </Paper>
      )}
      
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>User ID</TableCell>
              <TableCell>Activity Type</TableCell>
              <TableCell>Risk Score</TableCell>
              <TableCell>IP Address</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : activities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No suspicious activities found
                </TableCell>
              </TableRow>
            ) : (
              activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>{activity.id}</TableCell>
                  <TableCell>{activity.user_id}</TableCell>
                  <TableCell>{formatActivityType(activity.activity_type)}</TableCell>
                  <TableCell>
                    <Chip
                      label={activity.risk_score}
                      color={getRiskLevelColor(activity.risk_score)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{activity.ip_address}</TableCell>
                  <TableCell>{formatDate(activity.created_at)}</TableCell>
                  <TableCell>
                    {activity.reviewed ? (
                      <Chip
                        label={activity.resolution || 'Reviewed'}
                        color={
                          activity.resolution === 'LEGITIMATE' ? 'success' :
                          activity.resolution === 'FRAUDULENT' ? 'error' : 'warning'
                        }
                        size="small"
                      />
                    ) : (
                      <Chip label="Not Reviewed" variant="outlined" size="small" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => handleViewDetails(activity)}>
                          <InfoIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      
                      {!activity.reviewed && (
                        <Tooltip title="Review">
                          <IconButton size="small" onClick={() => handleOpenReview(activity)}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
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
      
      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Review Suspicious Activity</DialogTitle>
        <DialogContent>
          {reviewError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {reviewError}
            </Alert>
          )}
          
          {selectedActivity && (
            <>
              <Typography variant="subtitle2" gutterBottom>
                Activity Details:
              </Typography>
              <Typography variant="body2" gutterBottom>
                User ID: {selectedActivity.user_id}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Activity: {formatActivityType(selectedActivity.activity_type)}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Risk Score: {selectedActivity.risk_score}
              </Typography>
              <Typography variant="body2" gutterBottom>
                Date: {formatDate(selectedActivity.created_at)}
              </Typography>
            </>
          )}
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Resolution</InputLabel>
            <Select
              name="resolution"
              value={reviewData.resolution}
              onChange={handleReviewChange}
              label="Resolution"
            >
              <MenuItem value="LEGITIMATE">Legitimate Activity</MenuItem>
              <MenuItem value="FRAUDULENT">Fraudulent Activity</MenuItem>
              <MenuItem value="UNCERTAIN">Uncertain</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            name="notes"
            label="Review Notes"
            multiline
            rows={3}
            fullWidth
            margin="normal"
            value={reviewData.notes}
            onChange={handleReviewChange}
            placeholder="Add any notes about this review decision"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmitReview} 
            variant="contained" 
            color="primary"
            disabled={reviewLoading}
          >
            {reviewLoading ? <CircularProgress size={24} /> : 'Submit Review'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Suspicious Activity Details
          <IconButton
            aria-label="close"
            onClick={() => setDetailsDialogOpen(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedActivity && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Basic Information
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Activity ID:</strong> {selectedActivity.id}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>User ID:</strong> {selectedActivity.user_id}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Activity Type:</strong> {formatActivityType(selectedActivity.activity_type)}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Date & Time:</strong> {formatDate(selectedActivity.created_at)}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Risk Score:</strong> {selectedActivity.risk_score}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Status:</strong> {selectedActivity.reviewed ? 'Reviewed' : 'Not Reviewed'}
                  </Typography>
                  {selectedActivity.reviewed && (
                    <>
                      <Typography variant="body2" gutterBottom>
                        <strong>Resolution:</strong> {selectedActivity.resolution}
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        <strong>Reviewed By:</strong> {selectedActivity.reviewed_by || 'N/A'}
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        <strong>Review Date:</strong> {selectedActivity.reviewed_at ? formatDate(selectedActivity.reviewed_at) : 'N/A'}
                      </Typography>
                    </>
                  )}
                </Paper>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Location & Device
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>IP Address:</strong> {selectedActivity.ip_address}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Location:</strong> {selectedActivity.location || 'Unknown'}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Country:</strong> {selectedActivity.country || 'Unknown'}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>User Agent:</strong> {selectedActivity.user_agent || 'Unknown'}
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Device:</strong> {selectedActivity.device_type || 'Unknown'}
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Activity Details
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedActivity.metadata ? JSON.stringify(JSON.parse(selectedActivity.metadata), null, 2) : 'No additional details available'}
                  </Typography>
                </Paper>
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Risk Factors
                </Typography>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  {selectedActivity.risk_factors ? (
                    <Box component="ul" sx={{ pl: 2, mt: 0 }}>
                      {JSON.parse(selectedActivity.risk_factors).map((factor, index) => (
                        <Box component="li" key={index} sx={{ mb: 1 }}>
                          <Typography variant="body2">
                            <strong>{factor.name}:</strong> {factor.description} 
                            <Chip 
                              size="small" 
                              label={`+${factor.weight}`} 
                              color={factor.weight > 20 ? 'error' : 'warning'}
                              sx={{ ml: 1 }}
                            />
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2">No risk factors available</Typography>
                  )}
                </Paper>
              </Grid>
              
              {selectedActivity.reviewed && selectedActivity.review_notes && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Review Notes
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body2">
                      {selectedActivity.review_notes}
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          {selectedActivity && !selectedActivity.reviewed && (
            <Button 
              onClick={() => {
                setDetailsDialogOpen(false);
                handleOpenReview(selectedActivity);
              }} 
              color="primary"
            >
              Review This Activity
            </Button>
          )}
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}                