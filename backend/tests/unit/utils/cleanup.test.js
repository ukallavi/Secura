/**
 * Tests for cleanup.js
 * Tests the error and audit log retention policies
 */
const { purgeOldErrorLogs, purgeOldAuditLogs, archiveErrorLogs } = require('../../../utils/cleanup');
const { db } = require('../../../../database/db');
const fs = require('fs');
const path = require('path');

// Mock the database
jest.mock('../../../../database/db', () => {
  const mockDb = {
    where: jest.fn(() => mockDb),
    whereRaw: jest.fn(() => mockDb),
    select: jest.fn(() => mockDb),
    del: jest.fn(() => Promise.resolve(10)), // Mock deleting 10 records
    count: jest.fn(() => Promise.resolve([{ count: 100 }])),
    orderBy: jest.fn(() => mockDb),
    limit: jest.fn(() => mockDb),
    offset: jest.fn(() => mockDb)
  };
  
  return {
    db: jest.fn(table => {
      if (table === 'error_logs' || table === 'audit_logs') {
        return mockDb;
      }
      return mockDb;
    })
  };
});

// Mock file system
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn(() => Promise.resolve()),
    writeFile: jest.fn(() => Promise.resolve()),
    access: jest.fn(() => Promise.resolve())
  },
  existsSync: jest.fn(() => true)
}));

describe('Cleanup Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('purgeOldErrorLogs', () => {
    test('should purge error logs older than the retention period', async () => {
      const retentionDays = 90;
      const dryRun = false;
      
      const result = await purgeOldErrorLogs(retentionDays, dryRun);
      
      expect(result).toEqual({
        purged: 10,
        dryRun: false
      });
      
      expect(db).toHaveBeenCalledWith('error_logs');
      expect(db('error_logs').whereRaw).toHaveBeenCalledWith(
        expect.stringContaining('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)'),
        [retentionDays]
      );
      expect(db('error_logs').del).toHaveBeenCalled();
    });
    
    test('should not delete records in dry run mode', async () => {
      const retentionDays = 90;
      const dryRun = true;
      
      const result = await purgeOldErrorLogs(retentionDays, dryRun);
      
      expect(result).toEqual({
        purged: 0,
        dryRun: true,
        wouldPurge: 100
      });
      
      expect(db).toHaveBeenCalledWith('error_logs');
      expect(db('error_logs').whereRaw).toHaveBeenCalledWith(
        expect.stringContaining('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)'),
        [retentionDays]
      );
      expect(db('error_logs').count).toHaveBeenCalled();
      expect(db('error_logs').del).not.toHaveBeenCalled();
    });
    
    test('should handle database errors', async () => {
      const retentionDays = 90;
      const dryRun = false;
      
      // Mock a database error
      db('error_logs').del.mockRejectedValueOnce(new Error('Database error'));
      
      await expect(purgeOldErrorLogs(retentionDays, dryRun)).rejects.toThrow('Database error');
    });
    
    test('should use default retention period if not specified', async () => {
      const dryRun = false;
      
      await purgeOldErrorLogs(undefined, dryRun);
      
      expect(db('error_logs').whereRaw).toHaveBeenCalledWith(
        expect.stringContaining('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)'),
        [90] // Default retention period
      );
    });
  });
  
  describe('purgeOldAuditLogs', () => {
    test('should purge audit logs older than the retention period', async () => {
      const retentionDays = 365;
      const dryRun = false;
      
      const result = await purgeOldAuditLogs(retentionDays, dryRun);
      
      expect(result).toEqual({
        purged: 10,
        dryRun: false
      });
      
      expect(db).toHaveBeenCalledWith('audit_logs');
      expect(db('audit_logs').whereRaw).toHaveBeenCalledWith(
        expect.stringContaining('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)'),
        [retentionDays]
      );
      expect(db('audit_logs').del).toHaveBeenCalled();
    });
    
    test('should not delete records in dry run mode', async () => {
      const retentionDays = 365;
      const dryRun = true;
      
      const result = await purgeOldAuditLogs(retentionDays, dryRun);
      
      expect(result).toEqual({
        purged: 0,
        dryRun: true,
        wouldPurge: 100
      });
      
      expect(db).toHaveBeenCalledWith('audit_logs');
      expect(db('audit_logs').whereRaw).toHaveBeenCalledWith(
        expect.stringContaining('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)'),
        [retentionDays]
      );
      expect(db('audit_logs').count).toHaveBeenCalled();
      expect(db('audit_logs').del).not.toHaveBeenCalled();
    });
  });
  
  describe('archiveErrorLogs', () => {
    test('should archive error logs before purging', async () => {
      const retentionDays = 90;
      const archivePath = '/tmp/archives';
      
      // Mock error logs to archive
      db('error_logs').select.mockResolvedValueOnce([
        { id: 1, error_type: 'ERROR', error_message: 'Test error', created_at: '2024-01-01' },
        { id: 2, error_type: 'ERROR', error_message: 'Another error', created_at: '2024-01-02' }
      ]);
      
      const result = await archiveErrorLogs(retentionDays, archivePath);
      
      expect(result).toEqual({
        archived: 2,
        archivePath: expect.stringContaining(path.join(archivePath, 'error_logs_archive_'))
      });
      
      expect(db).toHaveBeenCalledWith('error_logs');
      expect(db('error_logs').whereRaw).toHaveBeenCalledWith(
        expect.stringContaining('created_at < DATE_SUB(NOW(), INTERVAL ? DAY)'),
        [retentionDays]
      );
      expect(db('error_logs').select).toHaveBeenCalled();
      
      expect(fs.promises.mkdir).toHaveBeenCalledWith(archivePath, { recursive: true });
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(path.join(archivePath, 'error_logs_archive_')),
        expect.any(String),
        'utf8'
      );
    });
    
    test('should handle empty result set', async () => {
      const retentionDays = 90;
      const archivePath = '/tmp/archives';
      
      // Mock empty result set
      db('error_logs').select.mockResolvedValueOnce([]);
      
      const result = await archiveErrorLogs(retentionDays, archivePath);
      
      expect(result).toEqual({
        archived: 0,
        archivePath: null
      });
      
      expect(fs.promises.writeFile).not.toHaveBeenCalled();
    });
    
    test('should create archive directory if it does not exist', async () => {
      const retentionDays = 90;
      const archivePath = '/tmp/archives';
      
      // Mock directory does not exist
      fs.existsSync.mockReturnValueOnce(false);
      
      // Mock error logs to archive
      db('error_logs').select.mockResolvedValueOnce([
        { id: 1, error_type: 'ERROR', error_message: 'Test error', created_at: '2024-01-01' }
      ]);
      
      await archiveErrorLogs(retentionDays, archivePath);
      
      expect(fs.promises.mkdir).toHaveBeenCalledWith(archivePath, { recursive: true });
    });
    
    test('should handle file system errors', async () => {
      const retentionDays = 90;
      const archivePath = '/tmp/archives';
      
      // Mock error logs to archive
      db('error_logs').select.mockResolvedValueOnce([
        { id: 1, error_type: 'ERROR', error_message: 'Test error', created_at: '2024-01-01' }
      ]);
      
      // Mock file system error
      fs.promises.writeFile.mockRejectedValueOnce(new Error('File system error'));
      
      await expect(archiveErrorLogs(retentionDays, archivePath)).rejects.toThrow('File system error');
    });
  });
});
