"use client"

import React, { useState, useEffect } from 'react';
import { 
  Box, Button, TextField, Typography, Paper, Alert, 
  CircularProgress, Dialog, DialogTitle, DialogContent, 
  DialogActions, List, ListItem, ListItemText, Divider 
} from '@mui/material';
import axios from 'axios';

const TwoFactorSetup = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ enabled: false, checked: false });
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);
  
  // Fetch 2FA status on component mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get('/api/auth/2fa/status');
        setStatus({ enabled: response.data.enabled, checked: true });
      } catch (error) {
        console.error('Error fetching 2FA status:', error);
      }
    };
    
    fetchStatus();
  }, []);
  
  // Initialize 2FA setup
  const handleSetup = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/auth/2fa/setup');
      setSetupData({
        qrCode: response.data.qrCode,
        secret: response.data.secret
      });
    } catch (error) {
      console.error('Error setting up 2FA:', error);
      setError('Failed to set up two-factor authentication');
    } finally {
      setLoading(false);
    }
  };
  
  // Verify and enable 2FA
  const handleVerify = async () => {
    if (!verificationCode) {
      setError('Please enter the verification code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('/api/auth/2fa/verify', {
        token: verificationCode
      });
      
      setSuccess('Two-factor authentication enabled successfully');
      setStatus({ ...status, enabled: true });
      setSetupData(null);
      
      // If recovery codes were returned, show them
      if (response.data.recoveryCodes) {
        setRecoveryCodes(response.data.recoveryCodes);
        setShowRecoveryCodes(true);
      }
    } catch (error) {
      console.error('Error verifying 2FA:', error);
      setError(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
      setVerificationCode('');
    }
  };
  
  // Disable 2FA
  const handleDisable = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await axios.post('/api/auth/2fa/disable');
      setSuccess('Two-factor authentication disabled successfully');
      setStatus({ ...status, enabled: false });
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      setError('Failed to disable two-factor authentication');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle recovery codes dialog close
  const handleRecoveryCodesClose = () => {
    setShowRecoveryCodes(false);
    setRecoveryCodes([]);
  };
  
  if (!status.checked) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Two-Factor Authentication
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {success}
        </Alert>
      )}
      
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Status: {status.enabled ? 'Enabled' : 'Disabled'}
        </Typography>
        
        {!status.enabled ? (
          <Box>
            <Typography variant="body1" paragraph>
              Enhance your account security by enabling two-factor authentication. 
              This adds an extra layer of protection by requiring a verification code 
              from your mobile device when you sign in.
            </Typography>
            
            {!setupData ? (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSetup}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : 'Set Up Two-Factor Authentication'}
              </Button>
            ) : (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  1. Scan this QR code with your authenticator app:
                </Typography>
                
                <Box sx={{ textAlign: 'center', my: 3 }}>
                  <img src={setupData.qrCode} alt="QR Code" style={{ maxWidth: '100%' }} />
                </Box>
                
                <Typography variant="subtitle1" gutterBottom>
                  2. Or manually enter this secret key into your authenticator app:
                </Typography>
                
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'background.default', 
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  letterSpacing: 1,
                  my: 2,
                  overflowWrap: 'break-word'
                }}>
                  {setupData.secret}
                </Box>
                
                <Typography variant="subtitle1" gutterBottom>
                  3. Enter the verification code from your authenticator app:
                </Typography>
                
                <TextField
                  fullWidth
                  label="Verification Code"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  margin="normal"
                  placeholder="e.g., 123456"
                  inputProps={{ maxLength: 6 }}
                />
                
                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleVerify}
                    disabled={loading || !verificationCode}
                  >
                    {loading ? <CircularProgress size={24} /> : 'Verify and Enable'}
                  </Button>
                  
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => setSetupData(null)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          <Box>
            <Typography variant="body1" paragraph>
              Two-factor authentication is currently enabled for your account. 
              You'll need to provide a verification code from your authenticator app 
              each time you sign in.
            </Typography>
            
            <Button
              variant="outlined"
              color="warning"
              onClick={handleDisable}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Disable Two-Factor Authentication'}
            </Button>
          </Box>
        )}
      </Paper>
      
      {/* Recovery Codes Dialog */}
      <Dialog 
        open={showRecoveryCodes} 
        onClose={handleRecoveryCodesClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Recovery Codes</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="error" paragraph>
            <strong>IMPORTANT:</strong> Store these recovery codes in a secure location. 
            Each code can only be used once to sign in if you lose access to your 
            authenticator app.
          </Typography>
          
          <List sx={{ bgcolor: 'background.default', borderRadius: 1 }}>
            {recoveryCodes.map((code, index) => (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemText 
                    primary={code} 
                    primaryTypographyProps={{ 
                      fontFamily: 'monospace',
                      letterSpacing: 1
                    }}
                  />
                </ListItem>
                {index < recoveryCodes.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleRecoveryCodesClose} color="primary">
            I've Saved These Codes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TwoFactorSetup;