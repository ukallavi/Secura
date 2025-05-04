# PowerShell script to set up secrets for Secura environments
# Usage: .\setup-secrets.ps1 [dev|test|prod]

param (
    [Parameter(Mandatory=$true)]
    [ValidateSet("dev", "test", "prod")]
    [string]$Environment
)

# Create secrets directory structure
$secretsDir = ".\secrets\$Environment"
New-Item -ItemType Directory -Path $secretsDir -Force | Out-Null

Write-Host "Generating secrets for $Environment environment..."

# Function to generate random string
function Get-RandomString {
    param (
        [int]$length
    )
    $bytes = New-Object Byte[] $length
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

# JWT Secret (64 bytes)
$jwtSecret = Get-RandomString -length 64
Set-Content -Path "$secretsDir\jwt_secret.txt" -Value $jwtSecret -NoNewline

# Encryption Key (32 bytes - AES-256)
$encryptionKey = Get-RandomString -length 32
Set-Content -Path "$secretsDir\encryption_key.txt" -Value $encryptionKey -NoNewline

# Database Password (32 bytes)
$dbPassword = Get-RandomString -length 32
Set-Content -Path "$secretsDir\db_password.txt" -Value $dbPassword -NoNewline

# MySQL Root Password (32 bytes)
$mysqlRootPassword = Get-RandomString -length 32
Set-Content -Path "$secretsDir\mysql_root_password.txt" -Value $mysqlRootPassword -NoNewline

# Error Tracking Salt (16 bytes)
$errorTrackingSalt = Get-RandomString -length 16
Set-Content -Path "$secretsDir\error_tracking_salt.txt" -Value $errorTrackingSalt -NoNewline

# Additional secrets for production
if ($Environment -eq "prod") {
    # Admin emails
    $adminEmails = Read-Host "Enter admin email addresses (comma-separated)"
    Set-Content -Path "$secretsDir\admin_emails.txt" -Value $adminEmails -NoNewline
    
    # SMTP Password
    $smtpPassword = Read-Host "Enter SMTP password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($smtpPassword)
    $smtpPasswordPlain = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    Set-Content -Path "$secretsDir\smtp_password.txt" -Value $smtpPasswordPlain -NoNewline
}

# Create directories for certbot if production
if ($Environment -eq "prod") {
    New-Item -ItemType Directory -Path ".\certbot\conf" -Force | Out-Null
    New-Item -ItemType Directory -Path ".\certbot\www" -Force | Out-Null
}

Write-Host "Secrets generated successfully for $Environment environment."
Write-Host "Make sure to keep these secrets secure and never commit them to version control."
Write-Host "Setup complete!"
