const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const backupDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

const command = `mysqldump -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > ${backupFile}`;

exec(command, (error, stdout, stderr) => {
  if (error) {
    console.error(`Backup error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Backup stderr: ${stderr}`);
    return;
  }
  console.log(`Database backup created at ${backupFile}`);
  
  // Clean up old backups (keep only last 7)
  fs.readdir(backupDir, (err, files) => {
    if (err) {
      console.error(`Error reading backup directory: ${err.message}`);
      return;
    }
    
    const backupFiles = files
      .filter(file => file.startsWith('backup-'))
      .map(file => ({ file, time: fs.statSync(path.join(backupDir, file)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);
    
    if (backupFiles.length > 7) {
      backupFiles.slice(7).forEach(({ file }) => {
        fs.unlinkSync(path.join(backupDir, file));
        console.log(`Deleted old backup: ${file}`);
      });
    }
  });
});