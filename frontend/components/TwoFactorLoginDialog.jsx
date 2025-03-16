import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import axios from 'axios';

const TwoFactorLoginDialog = ({ open, userId, onSuccess, onCancel }) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isRecoveryCode, setIsRecoveryCode] = useState(false);
  
  const handleSubmit = async () => {
    if (!verificationCode) {
      setError('Please enter a verification code');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      await axios.post('/api/auth/2fa/login', {
        userId,
        token: verificationCode
      });
      
      onSuccess();
    } catch (error) {
      console.error('2FA verification error:', error);
      setError(error.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleCodeType = () => {
    setIsRecoveryCode(!isRecoveryCode);
    setVerificationCode('');
    setError('');
  };
  
  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>Two-Factor Authentication Required</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <Typography variant="body1" paragraph>
          {isRecoveryCode 
            ? 'Enter one of your recovery codes to sign in.' 
            : 'Enter the verification code from your authenticator app.'}
        </Typography>
        
        <TextField
          fullWidth
          label={isRecoveryCode ? "Recovery Code" : "Verification Code"}
          value={verificationCode}
          onChange={(e) => setVerificationCode(e.target.value)}
          margin="normal"
          placeholder={isRecoveryCode ? "XXXX-XXXX-XXXX-XXXX-XXXX" : "123456"}
          inputProps={{ 
            maxLength: isRecoveryCode ? 24 : 6,
            style: { letterSpacing: isRecoveryCode ? 1 : 'normal' }
          }}
        />
        
        <Box sx={{ mt: 2 }}>
          <Button 
            color="secondary" 
            size="small" 
            onClick={toggleCodeType}
          >
            {isRecoveryCode 
              ? "Use verification code instead" 
              : "Use recovery code instead"}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          color="primary" 
          variant="contained" 
          disabled={loading || !verificationCode}
        >
          {loading ? <CircularProgress size={24} /> : 'Verify'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TwoFactorLoginDialog;