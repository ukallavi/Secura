-- Database initialization script for Docker

-- Create databases
CREATE DATABASE IF NOT EXISTS secura_dev;
CREATE DATABASE IF NOT EXISTS secura_test;

-- Set character set
ALTER DATABASE secura_dev CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
ALTER DATABASE secura_test CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Grant privileges
GRANT ALL PRIVILEGES ON secura_dev.* TO 'secura_user'@'%';
GRANT ALL PRIVILEGES ON secura_test.* TO 'secura_user'@'%';

FLUSH PRIVILEGES;
