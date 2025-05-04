'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Download } from 'lucide-react';
import { ENDPOINTS } from '@/lib/api-config';
import { getEncryptionKey, decryptData } from '@/lib/encryption';

export function ExportPasswordsDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportEncrypted, setExportEncrypted] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all passwords
      const response = await fetch(`${ENDPOINTS.PASSWORDS}?limit=1000`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch passwords for export');
      }
      
      const data = await response.json();
      const passwords = data.passwords || [];
      
      if (passwords.length === 0) {
        throw new Error('No passwords to export');
      }

      // Get the encryption key for decryption if needed
      const encryptionKey = getEncryptionKey();
      if (!encryptionKey && !exportEncrypted) {
        throw new Error('Encryption key not found. Please log in again or export encrypted data.');
      }

      // Process passwords for export
      let exportData = [];
      
      for (const pwd of passwords) {
        try {
          let passwordValue = pwd.password;
          
          // Decrypt password if not exporting encrypted data
          if (!exportEncrypted && typeof pwd.password === 'string' && pwd.password.startsWith('{')) {
            passwordValue = await decryptData(pwd.password, encryptionKey);
          }
          
          exportData.push({
            title: pwd.title,
            website: pwd.website || '',
            username: pwd.username || '',
            password: passwordValue,
            notes: includeNotes ? (pwd.notes || '') : '',
            category: pwd.category || '',
            favorite: pwd.favorite ? 'Yes' : 'No',
            created: new Date(pwd.created_at).toISOString().split('T')[0],
            updated: new Date(pwd.updated_at).toISOString().split('T')[0]
          });
        } catch (err) {
          console.error(`Failed to process password ${pwd.id} for export:`, err);
          // Continue with other passwords even if one fails
        }
      }

      // Generate file content based on format
      let fileContent = '';
      let fileName = `secura-passwords-${new Date().toISOString().split('T')[0]}`;
      let mimeType = '';
      
      if (exportFormat === 'csv') {
        // CSV format
        const headers = ['Title', 'Website', 'Username', 'Password', 'Notes', 'Category', 'Favorite', 'Created', 'Updated'];
        fileContent = headers.join(',') + '\n';
        
        for (const item of exportData) {
          const values = [
            escapeCsvValue(item.title),
            escapeCsvValue(item.website),
            escapeCsvValue(item.username),
            escapeCsvValue(item.password),
            includeNotes ? escapeCsvValue(item.notes) : '',
            escapeCsvValue(item.category),
            item.favorite,
            item.created,
            item.updated
          ];
          fileContent += values.join(',') + '\n';
        }
        
        fileName += '.csv';
        mimeType = 'text/csv';
      } else if (exportFormat === 'json') {
        // JSON format
        fileContent = JSON.stringify(exportData, null, 2);
        fileName += '.json';
        mimeType = 'application/json';
      }

      // Create and download the file
      const blob = new Blob([fileContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to export passwords');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to escape CSV values
  const escapeCsvValue = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    // If the value contains a comma, newline, or double quote, enclose it in double quotes
    if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
      // Replace any double quotes with two double quotes
      return '"' + stringValue.replace(/"/g, '""') + '"';
    }
    return stringValue;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export Passwords
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Passwords</DialogTitle>
          <DialogDescription>
            Export your passwords to a file. Choose your preferred format and options.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="exportFormat">Export Format</Label>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="formatCsv"
                  name="exportFormat"
                  value="csv"
                  checked={exportFormat === 'csv'}
                  onChange={() => setExportFormat('csv')}
                />
                <Label htmlFor="formatCsv">CSV</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="formatJson"
                  name="exportFormat"
                  value="json"
                  checked={exportFormat === 'json'}
                  onChange={() => setExportFormat('json')}
                />
                <Label htmlFor="formatJson">JSON</Label>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeNotes"
              checked={includeNotes}
              onCheckedChange={setIncludeNotes}
            />
            <Label htmlFor="includeNotes">Include notes</Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="exportEncrypted"
              checked={exportEncrypted}
              onCheckedChange={setExportEncrypted}
            />
            <Label htmlFor="exportEncrypted">Export encrypted data (for backup)</Label>
          </div>
          
          {exportEncrypted && (
            <Alert className="bg-yellow-50 border-yellow-200">
              <AlertDescription>
                Exporting encrypted data is useful for backups but cannot be imported into other password managers.
              </AlertDescription>
            </Alert>
          )}
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
