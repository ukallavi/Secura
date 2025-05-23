"use client"

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { 
  Box, Button, TextField, Typography, Paper, 
  CircularProgress, Alert, Link as MuiLink 
} from '@mui/material';
import TwoFactorLoginDialog from '@/components/TwoFactorLoginDialog';
import Link from 'next/link';

const Login = () => {
  const router = useRouter();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Two-factor authentication state
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [userId, setUserId] = useState(null);
  const [encryptionSalt, setEncryptionSalt] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Use the AuthContext's login function instead of direct fetch
      const result = await login({ email, password });
      
      // Check if there was an error
      if (result.error) {
        throw new Error(result.error || 'Login failed');
      }
      
      // Check if 2FA is required
      if (result.requireTwoFactor) {
        setUserId(result.userId);
        setEncryptionSalt(result.encryptionSalt);
        setShowTwoFactor(true);
        setLoading(false);
        return;
      }
      
      // Normal login success - AuthContext will handle the redirect
      console.log('Login successful');
    } catch (error) {
      console.error('Login error:', error);
      setError(error.message || 'Login failed. Please check your credentials and try again.');
      setLoading(false);
    }
  };
  
  const handleTwoFactorSuccess = () => {
    router.push('/main/passwords');
  };
  
  const handleTwoFactorCancel = () => {
    setShowTwoFactor(false);
    setUserId(null);
    setLoading(false);
  };
  
  return (
    <Box sx={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      p: 2
    }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
        <Typography variant="h4" component="h1" align="center" gutterBottom>
          Login to Ssecura
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
          />
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {loading ? <CircularProgress size={24} /> : 'Login'}
          </Button>
        </form>
        
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2">
            Don't have an account?{' '}
            <MuiLink component={Link} href="/register">
              Register
            </MuiLink>
          </Typography>
          
          <Typography variant="body2" sx={{ mt: 1 }}>
            <MuiLink component={Link} href="/forgot-password">
              Forgot your password?
            </MuiLink>
          </Typography>
        </Box>
      </Paper>
      
      {/* Two-Factor Authentication Dialog */}
      <TwoFactorLoginDialog
        open={showTwoFactor}
        userId={userId}
        encryptionSalt={encryptionSalt}
        masterPassword={password} // Pass the master password for encryption setup
        onSuccess={handleTwoFactorSuccess}
        onCancel={handleTwoFactorCancel}
      />
    </Box>
  );
};

export default Login;