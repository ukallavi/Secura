import React, { useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, Paper, Switch, FormControlLabel, 
         Snackbar, IconButton, InputAdornment, CircularProgress } from '@mui/material';
import { Visibility, VisibilityOff, ContentCopy } from '@mui/icons-material';
import axios from 'axios';

const LegacyPasswordGenerator = () => {
  // Form state
  const [alias, setAlias] = useState('');
  const [secret, setSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Override settings
  const [overrideSettings, setOverrideSettings] = useState({
    Domain: '',
    IgnoreCase: true,
    RemoveSpecialCharacters: false,
    SuffixZero: false,
    PrefixHash: false
  });
  
  // User's saved overrides
  const [savedOverrides, setSavedOverrides] = useState([]);
  
  // Notifications
  const [notification, setNotification] = useState({
    open: false,
    message: ''
  });
  
  // Fetch saved overrides if user is logged in
  useEffect(() => {
    const fetchOverrides = async () => {
      try {
        const response = await axios.get('/api/compatibility/overrides');
        if (response.data && response.data.overrides) {
          setSavedOverrides(response.data.overrides);
        }
      } catch (error) {
        console.error('Error fetching overrides:', error);
        // User might not be logged in, that's okay
      }
    };
    
    fetchOverrides();
  }, []);
  
  // Handle override setting changes
  const handleOverrideChange = (setting) => (event) => {
    setOverrideSettings({
      ...overrideSettings,
      [setting]: event.target.checked
    });
  };
  
  // Generate password
  const handleGeneratePassword = async () => {
    if (!alias || !secret) {
      setNotification({
        open: true,
        message: 'Please enter both alias and secret'
      });
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post('/api/compatibility/generate', {
        alias,
        secret,
        overrideSettings
      });
      
      setPassword(response.data.password);
    } catch (error) {
      console.error('Error generating password:', error);
      setNotification({
        open: true,
        message: 'Error generating password'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Save override settings
  const handleSaveOverride = async () => {
    if (!overrideSettings.Domain) {
      setNotification({
        open: true,
        message: 'Please enter a domain for this override'
      });
      return;
    }
    
    try {
      await axios.post('/api/compatibility/override', {
        domain: overrideSettings.Domain,
        ignoreCase: overrideSettings.IgnoreCase,
        removeSpecialCharacters: overrideSettings.RemoveSpecialCharacters,
        suffixZero: overrideSettings.SuffixZero,
        prefixHash: overrideSettings.PrefixHash
      });
      
      setNotification({
        open: true,
        message: 'Override settings saved successfully'
      });
      
      // Refresh the overrides list
      const response = await axios.get('/api/compatibility/overrides');
      if (response.data && response.data.overrides) {
        setSavedOverrides(response.data.overrides);
      }
    } catch (error) {
      console.error('Error saving override:', error);
      setNotification({
        open: true,
        message: 'Error saving override settings'
      });
    }
  };
  
  // Copy password to clipboard
  const handleCopyPassword = () => {
    navigator.clipboard.writeText(password).then(() => {
      setNotification({
        open: true,
        message: 'Password copied to clipboard'
      });
    });
  };
  
  // Load a saved override
  const handleLoadOverride = (override) => {
    setOverrideSettings(override);
    if (override.Domain) {
      setAlias(override.Domain);
    }
  };
  
  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Legacy Password Generator
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        This tool recreates passwords from the old system. Enter your alias and secret key to generate the same password as before.
      </Typography>
      
      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Generate Password
        </Typography>
        
        <TextField
          fullWidth
          label="Alias"
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          margin="normal"
          placeholder="e.g., gmail, facebook, bank"
        />
        
        <TextField
          fullWidth
          label="Secret Key"
          type={showSecret ? 'text' : 'password'}
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          margin="normal"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowSecret(!showSecret)}
                  edge="end"
                >
                  {showSecret ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Override Settings
          </Typography>
          
          <TextField
            fullWidth
            label="Domain"
            value={overrideSettings.Domain}
            onChange={(e) => setOverrideSettings({...overrideSettings, Domain: e.target.value})}
            margin="normal"
            placeholder="Domain for this override"
            size="small"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={overrideSettings.IgnoreCase}
                onChange={handleOverrideChange('IgnoreCase')}
              />
            }
            label="Ignore Case"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={overrideSettings.RemoveSpecialCharacters}
                onChange={handleOverrideChange('RemoveSpecialCharacters')}
              />
            }
            label="Remove Special Characters"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={overrideSettings.SuffixZero}
                onChange={handleOverrideChange('SuffixZero')}
              />
            }
            label="Suffix Zero"
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={overrideSettings.PrefixHash}
                onChange={handleOverrideChange('PrefixHash')}
              />
            }
            label="Prefix Hash (#)"
          />
        </Box>
        
        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleGeneratePassword}
            disabled={loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Generate Password'}
          </Button>
          
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleSaveOverride}
            disabled={!overrideSettings.Domain}
          >
            Save Override
          </Button>
        </Box>
        
        {password && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="subtitle1" gutterBottom>
              Generated Password:
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                fullWidth
                value={password}
                InputProps={{
                  readOnly: true,
                }}
                variant="outlined"
              />
              <IconButton onClick={handleCopyPassword} color="primary">
                <ContentCopy />
              </IconButton>
            </Box>
          </Box>
        )}
      </Paper>
      
      {savedOverrides.length > 0 && (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Saved Overrides
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {savedOverrides.map((override, index) => (
              <Box 
                key={index} 
                sx={{ 
                  p: 2, 
                  border: '1px solid', 
                  borderColor: 'divider',
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <Typography variant="subtitle2">
                  {override.Domain}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {[
                    override.IgnoreCase ? 'Ignore Case' : null,
                    override.RemoveSpecialCharacters ? 'No Special Chars' : null,
                    override.SuffixZero ? 'Suffix 0' : null,
                    override.PrefixHash ? 'Prefix #' : null
                  ].filter(Boolean).join(', ')}
                </Typography>
                <Button 
                  size="small" 
                  onClick={() => handleLoadOverride(override)}
                  sx={{ mt: 1 }}
                >
                  Use This Override
                </Button>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
      
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({...notification, open: false})}
        message={notification.message}
      />
    </Box>
  );
};

export default LegacyPasswordGenerator;