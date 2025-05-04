'use client';

import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { sanitizeBooleans } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Shield, Lock, UserCheck, MapPin, Clock } from "lucide-react";
import { useAuth } from '@/lib/auth';
import { ENDPOINTS } from '@/lib/api-config';
import { fetchWithCSRF } from '@/lib/fetchWithCSRF';

export default function SecurityPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [securityScore, setSecurityScore] = useState(0);
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorEnabled: false,
    passwordStrengthCheck: true,
    loginNotifications: false,
    inactivityTimeout: true,
    passwordExpiryCheck: true
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [securityRecommendations, setSecurityRecommendations] = useState([]);
  
  useEffect(() => {
    // Load security data from the backend
    const loadSecurityData = async () => {
      setLoading(true);
      try {
        // Fetch security score and settings
        const scoreResponse = await fetchWithCSRF(ENDPOINTS.SECURITY_SCORE);
        if (scoreResponse.success) {
          setSecurityScore(scoreResponse.securityScore);
          setSecuritySettings({
            twoFactorEnabled: scoreResponse.settings.twoFactorEnabled,
            passwordStrengthCheck: scoreResponse.settings.passwordStrengthCheck,
            loginNotifications: scoreResponse.settings.loginNotifications,
            inactivityTimeout: scoreResponse.settings.inactivityTimeout,
            passwordExpiryCheck: scoreResponse.settings.passwordExpiryCheck
          });
        }
        
        // Fetch security activity
        const activityResponse = await fetchWithCSRF(ENDPOINTS.SECURITY_ACTIVITY);
        if (activityResponse.success) {
          setRecentActivity(activityResponse.activities);
        }
        
        // Fetch security recommendations
        const recommendationsResponse = await fetchWithCSRF(ENDPOINTS.SECURITY_RECOMMENDATIONS);
        if (recommendationsResponse.success) {
          // Add icon mapping to recommendations
          const recommendationsWithIcons = recommendationsResponse.recommendations.map(rec => ({
            ...rec,
            icon: rec.id === 'two-factor' ? Shield : 
                  rec.id === 'login-notifications' ? AlertCircle : 
                  rec.id === 'weak-passwords' ? Lock : AlertCircle
          }));
          setSecurityRecommendations(recommendationsWithIcons);
        }
      } catch (error) {
        console.error('Error loading security data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSecurityData();
  }, []);
  
  // These functions are now handled by the backend
  // Keeping them here for reference or fallback if needed
  const calculateSecurityScore = (settings) => {
    const enabledFeatures = Object.values(settings).filter(Boolean).length;
    return enabledFeatures * 20;
  };
  
  const handleToggleSetting = async (setting) => {
    // Optimistically update UI first
    // Prepare backend payload (convert keys)
    const backendPayload = {
      twoFactorEnabled: !!(setting === 'twoFactorEnabled' ? !securitySettings.twoFactorEnabled : securitySettings.twoFactorEnabled),
      passwordStrengthCheck: !!(setting === 'passwordStrengthCheck' ? !securitySettings.passwordStrengthCheck : securitySettings.passwordStrengthCheck),
      loginNotifications: !!(setting === 'loginNotifications' ? !securitySettings.loginNotifications : securitySettings.loginNotifications),
      inactivityTimeout: !!(setting === 'inactivityTimeout' ? !securitySettings.inactivityTimeout : securitySettings.inactivityTimeout),
      passwordExpiryCheck: !!(setting === 'passwordExpiryCheck' ? !securitySettings.passwordExpiryCheck : securitySettings.passwordExpiryCheck)
    };
    setSecuritySettings({ ...securitySettings, [setting]: !securitySettings[setting] });
    try {
      // Save changes to backend
      // Ensure all payload values are booleans
      const sanitizedPayload = sanitizeBooleans(backendPayload);
      const response = await fetchWithCSRF(ENDPOINTS.SECURITY_SETTINGS, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sanitizedPayload)
      });
      
      if (response.success) {
        // Update security score based on response
        setSecurityScore(response.securityScore);
        
        // Refresh recommendations after settings change
        const recommendationsResponse = await fetchWithCSRF(ENDPOINTS.SECURITY_RECOMMENDATIONS);
        if (recommendationsResponse.success) {
          const recommendationsWithIcons = recommendationsResponse.recommendations.map(rec => ({
            ...rec,
            icon: rec.id === 'two-factor' ? Shield : 
                  rec.id === 'login-notifications' ? AlertCircle : 
                  rec.id === 'weak-passwords' ? Lock : AlertCircle
          }));
          setSecurityRecommendations(recommendationsWithIcons);
        }
      } else {
        // If save failed, revert the UI change
        console.error('Failed to update security settings:', response.message);
        setSecuritySettings(securitySettings);
      }
    } catch (error) {
      console.error('Error updating security settings:', error);
      // Revert UI change on error
      setSecuritySettings(securitySettings);
    }
  };
  
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };
  
  const formatAction = (action) => {
    return action.replace(/_/g, ' ');
  };
  
  // Custom toggle switch component
  const ToggleSwitch = ({ checked, onChange, id }) => (
    <div 
      className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted transition-colors cursor-pointer"
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      id={id}
    >
      <span 
        className="inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform"
        style={{ transform: checked ? 'translateX(20px)' : 'translateX(2px)' }}
      />
    </div>
  );
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading security information...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Security Center</h1>
      
      <div className="mb-6 border-b">
        <div className="flex space-x-6 mb-4">
          <button 
            className={`pb-2 px-1 font-medium ${activeTab === 'overview' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`pb-2 px-1 font-medium ${activeTab === 'settings' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('settings')}
          >
            Security Settings
          </button>
          <button 
            className={`pb-2 px-1 font-medium ${activeTab === 'activity' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            onClick={() => setActiveTab('activity')}
          >
            Recent Activity
          </button>
        </div>
      </div>
      
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Score</CardTitle>
              <CardDescription>Your account security rating</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32 mb-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold">{securityScore}%</span>
                  </div>
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      className="text-muted stroke-current"
                      strokeWidth="10"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="50"
                      cy="50"
                    />
                    <circle
                      className="text-primary stroke-current"
                      strokeWidth="10"
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="40"
                      cx="50"
                      cy="50"
                      strokeDasharray={`${securityScore * 2.51} 251.2`}
                      strokeDashoffset="0"
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  {securityScore < 40 ? 'Your account security needs improvement' :
                   securityScore < 80 ? 'Your account security is good' :
                   'Your account security is excellent'}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Security Recommendations</CardTitle>
              <CardDescription>Steps to improve your security</CardDescription>
            </CardHeader>
            <CardContent>
              {securityRecommendations.length > 0 ? (
                <div className="space-y-4">
                  {securityRecommendations.map(recommendation => (
                    <div key={recommendation.id} className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        <recommendation.icon className="h-5 w-5 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="font-medium">{recommendation.title}</h3>
                        <p className="text-sm text-muted-foreground">{recommendation.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24">
                  <p className="text-muted-foreground">No recommendations at this time</p>
                </div>
              )}
            </CardContent>
            {securityRecommendations.length > 0 && (
              <CardFooter>
                <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => setActiveTab('settings')}
          >
            View All Recommendations
          </Button>
              </CardFooter>
            )}
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest security events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.slice(0, 3).map(activity => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="mt-0.5">
                      {activity.action === 'LOGIN' ? (
                        <UserCheck className="h-4 w-4 text-green-500" />
                      ) : activity.action === 'PASSWORD_UPDATE' ? (
                        <Lock className="h-4 w-4 text-blue-500" />
                      ) : (
                        <Clock className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{formatAction(activity.action)}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(activity.timestamp)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{activity.location} • {activity.device}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => setActiveTab('activity')}
          >
            View All Activity
          </Button>
            </CardFooter>
          </Card>
        </div>
      )}
      
      {activeTab === 'settings' && (
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>Configure your account security preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Require a verification code when logging in</p>
              </div>
              <ToggleSwitch 
                id="two-factor"
                checked={securitySettings.twoFactorEnabled}
                onChange={() => handleToggleSetting('twoFactorEnabled')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="password-strength">Password Strength Check</Label>
                <p className="text-sm text-muted-foreground">Ensure passwords meet minimum security requirements</p>
              </div>
              <ToggleSwitch 
                id="password-strength"
                checked={securitySettings.passwordStrengthCheck}
                onChange={() => handleToggleSetting('passwordStrengthCheck')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="login-notifications">Login Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive alerts for new device logins</p>
              </div>
              <ToggleSwitch 
                id="login-notifications"
                checked={securitySettings.loginNotifications}
                onChange={() => handleToggleSetting('loginNotifications')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="inactivity-timeout">Inactivity Timeout</Label>
                <p className="text-sm text-muted-foreground">Automatically log out after 30 minutes of inactivity</p>
              </div>
              <ToggleSwitch 
                id="inactivity-timeout"
                checked={securitySettings.inactivityTimeout}
                onChange={() => handleToggleSetting('inactivityTimeout')}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="password-expiry">Password Expiry Check</Label>
                <p className="text-sm text-muted-foreground">Prompt to change passwords older than 90 days</p>
              </div>
              <ToggleSwitch 
                id="password-expiry"
                checked={securitySettings.passwordExpiryCheck}
                onChange={() => handleToggleSetting('passwordExpiryCheck')}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="ml-auto" 
              onClick={async () => {
                try {
                  // Prepare backend payload (convert keys)
                  const backendPayload = {
                    twoFactorEnabled: securitySettings.twoFactorEnabled,
                    passwordStrengthCheck: securitySettings.passwordStrengthCheck,
                    loginNotifications: securitySettings.loginNotifications,
                    inactivityTimeout: securitySettings.inactivityTimeout,
                    passwordExpiryCheck: securitySettings.passwordExpiryCheck
                  };
                  const response = await fetchWithCSRF(ENDPOINTS.SECURITY_SETTINGS, {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(backendPayload)
                  });
                  
                  if (response.success) {
                    // Update security score based on response
                    setSecurityScore(response.securityScore);
                    alert('Security settings saved successfully!');
                    
                    // Refresh recommendations after settings change
                    const recommendationsResponse = await fetchWithCSRF(ENDPOINTS.SECURITY_RECOMMENDATIONS);
                    if (recommendationsResponse.success) {
                      const recommendationsWithIcons = recommendationsResponse.recommendations.map(rec => ({
                        ...rec,
                        icon: rec.id === 'two-factor' ? Shield : 
                              rec.id === 'login-notifications' ? AlertCircle : 
                              rec.id === 'weak-passwords' ? Lock : AlertCircle
                      }));
                      setSecurityRecommendations(recommendationsWithIcons);
                    }
                  } else {
                    alert('Failed to save security settings: ' + response.message);
                  }
                } catch (error) {
                  console.error('Error saving security settings:', error);
                  alert('An error occurred while saving security settings');
                }
              }}
            >
              Save Changes
            </Button>
          </CardFooter>
        </Card>
      )}
      
      {activeTab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Security Activity</CardTitle>
            <CardDescription>Recent security events for your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <div className="grid grid-cols-4 p-4 font-medium border-b">
                <div>Action</div>
                <div>Time</div>
                <div>Location</div>
                <div>Device</div>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="grid grid-cols-4 p-4 border-b last:border-0 items-center">
                      <div className="font-medium flex items-center space-x-2">
                        {activity.action === 'LOGIN' ? (
                          <UserCheck className="h-4 w-4 text-green-500" />
                        ) : activity.action === 'PASSWORD_UPDATE' ? (
                          <Lock className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-gray-500" />
                        )}
                        <span>{formatAction(activity.action)}</span>
                      </div>
                      <div>{formatTime(activity.timestamp)}</div>
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span>{activity.location}</span>
                      </div>
                      <div>{activity.device}</div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    No recent activity found
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
