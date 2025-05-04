'use client';

import { useState, useRef } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload } from 'lucide-react';
import { ENDPOINTS } from '@/lib/api-config';
import { getEncryptionKey, encryptData } from '@/lib/encryption';
import { useToast } from '@/hooks/use-toast';

export function ImportPasswordsDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [importFormat, setImportFormat] = useState('csv');
  const [importedCount, setImportedCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFileName(e.target.files[0].name);
    }
  };

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(header => header.trim());
    
    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let inQuote = false;
      let currentValue = '';
      
      // Parse CSV line considering quoted values
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        
        if (char === '"' && (j === 0 || lines[i][j-1] !== '\\')) {
          if (inQuote && j < lines[i].length - 1 && lines[i][j+1] === '"') {
            // Double quote inside quoted value
            currentValue += '"';
            j++; // Skip the next quote
          } else {
            // Toggle quote state
            inQuote = !inQuote;
          }
        } else if (char === ',' && !inQuote) {
          // End of value
          values.push(currentValue);
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      
      // Add the last value
      values.push(currentValue);
      
      // Create object from headers and values
      const obj = {};
      for (let j = 0; j < headers.length && j < values.length; j++) {
        obj[headers[j].toLowerCase()] = values[j];
      }
      
      result.push(obj);
    }
    
    return result;
  };

  const handleImport = async () => {
    if (!fileInputRef.current || !fileInputRef.current.files || fileInputRef.current.files.length === 0) {
      setError('Please select a file to import');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const file = fileInputRef.current.files[0];
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          const content = e.target.result;
          let passwords = [];
          
          // Parse file based on format
          if (importFormat === 'csv') {
            passwords = parseCSV(content);
          } else if (importFormat === 'json') {
            passwords = JSON.parse(content);
          }
          
          if (!passwords || passwords.length === 0) {
            throw new Error('No valid passwords found in the imported file');
          }
          
          // Get encryption key for encrypting passwords
          const encryptionKey = getEncryptionKey();
          if (!encryptionKey) {
            throw new Error('Encryption key not found. Please log in again.');
          }
          
          // Process and save each password
          let successCount = 0;
          
          for (const pwd of passwords) {
            try {
              // Normalize field names
              const passwordData = {
                title: pwd.title || pwd.name || pwd.account || '',
                website: pwd.website || pwd.url || pwd.site || '',
                username: pwd.username || pwd.user || pwd.email || '',
                password: pwd.password || '',
                notes: pwd.notes || pwd.note || pwd.comments || '',
                category: pwd.category || pwd.group || pwd.folder || 'imported',
                favorite: pwd.favorite === 'Yes' || pwd.favorite === true || false
              };
              
              // Validate required fields
              if (!passwordData.title || !passwordData.password) {
                console.warn('Skipping import of password with missing title or password');
                continue;
              }
              
              // Encrypt the password
              const encryptedPassword = await encryptData(passwordData.password, encryptionKey);
              
              // Save to server
              await fetchWithCSRF(ENDPOINTS.PASSWORDS, {
                method: 'POST',
                body: JSON.stringify({
                  title: passwordData.title,
                  website: passwordData.website,
                  username: passwordData.username,
                  password: encryptedPassword,
                  notes: passwordData.notes,
                  category: passwordData.category,
                  favorite: passwordData.favorite
                }),
              });
              
              // If we get here without an error being thrown, the request was successful
              successCount++;
            } catch (err) {
              console.error('Error importing password:', err);
              // Continue with other passwords even if one fails
            }
          }
          
          setImportedCount(successCount);
          
          if (successCount > 0) {
            toast({
              title: "Import successful",
              description: `Successfully imported ${successCount} passwords.`,
            });
            setOpen(false);
          } else {
            throw new Error('Failed to import any passwords. Please check the file format.');
          }
        } catch (err) {
          setError(err.message || 'Failed to import passwords');
          setLoading(false);
        }
      };
      
      fileReader.onerror = () => {
        setError('Failed to read the file');
        setLoading(false);
      };
      
      fileReader.readAsText(file);
    } catch (err) {
      setError(err.message || 'Failed to import passwords');
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Import Passwords
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Passwords</DialogTitle>
          <DialogDescription>
            Import passwords from a CSV or JSON file. All passwords will be encrypted before saving.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="importFormat">Import Format</Label>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="importFormatCsv"
                  name="importFormat"
                  value="csv"
                  checked={importFormat === 'csv'}
                  onChange={() => setImportFormat('csv')}
                />
                <Label htmlFor="importFormatCsv">CSV</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="importFormatJson"
                  name="importFormat"
                  value="json"
                  checked={importFormat === 'json'}
                  onChange={() => setImportFormat('json')}
                />
                <Label htmlFor="importFormatJson">JSON</Label>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="file">Select File</Label>
            <div className="flex items-center space-x-2">
              <input
                type="file"
                id="file"
                ref={fileInputRef}
                accept={importFormat === 'csv' ? '.csv' : '.json'}
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
              <span className="text-sm text-muted-foreground">
                {fileName || 'No file selected'}
              </span>
            </div>
          </div>
          
          <Alert>
            <AlertDescription>
              For CSV imports, the file should have headers: Title, Website, Username, Password, Notes, Category, Favorite
            </AlertDescription>
          </Alert>
          
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
          <Button onClick={handleImport} disabled={loading || !fileName}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
