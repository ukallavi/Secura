# Ssecura

## Project Overview

Ssecura is a modern, secure password management system with advanced security monitoring features. This application provides end-to-end encryption for storing sensitive credentials while offering robust administrative controls for user security management.

## Features

### User Management
- Secure account creation and authentication
- Two-factor authentication (2FA) with QR code setup
- Account recovery options with secure recovery keys
- Session management with ability to revoke sessions

### Password Management
- End-to-end encrypted password storage
- Password generation with customizable parameters
- Password health monitoring and strength assessment
- Secure sharing capabilities

### Security Monitoring
- Comprehensive activity logging and auditing
- Risk-based scoring of user activities
- Anomaly detection for suspicious behaviors
- Multi-level monitoring capabilities (BASIC, ENHANCED, STRICT)
- Geographic access analysis

### Administrative Controls
- User activity monitoring dashboard
- Suspicious activity review workflow
- Account lockout and security enforcement
- Detailed reporting and analytics

## Technology Stack

### Frontend
- Next.js for server-side rendering and routing
- React for component-based UI
- Material UI and custom UI components
- Client-side encryption for sensitive data

### Backend
- Node.js with Express for API endpoints
- JWT-based authentication with refresh token rotation
- Rate limiting and CSRF protection
- Comprehensive logging and error handling

### Database
- MySQL for structured data storage
- Encrypted sensitive fields
- Optimized queries for performance

## Getting Started

### Prerequisites
- Node.js (v14+)
- MySQL (v8+)
- npm or yarn
- Docker and Docker Compose (optional, for containerized setup)

### Installation

1. Clone the repository
```bash
git clone https://github.com/ukallavi/secura.git
cd secura
```

2. Install dependencies
```bash
# Install backend dependencies
cd backend
npm install


# Install frontend dependencies
cd ../frontend
npm install
```

3. Configure environment variables
```bash
# In root directory
cp .env.example .env
# Edit .env with your database and other configuration settings
```

4. Set up the database
```bash
# Using the schema files
mysql -u root -p < database/database-schema.sql
mysql -u root -p < database/database-indexes.sql
```

5. Start the development servers
```bash
# Start backend (from backend directory)
npm run dev

# Start frontend (from frontend directory)
npm run dev
```

6. Access the application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Docker Setup (Alternative)

1. Generate secure keys for Docker environment
```bash
node scripts/generate-docker-keys.js
```

2. Build and start the containers
```bash
docker-compose up -d
```

3. Access the application
- Frontend: http://localhost:80
- Backend API: http://localhost:5000

## Security Features
- All passwords are encrypted using AES-256-GCM
- Master password never leaves the client
- PBKDF2 key derivation with high iteration count
- Automatic session timeout
- IP-based access controls
- Brute force protection
- Regular security audits and backup system

## Development

### Project Structure
```
secura/
├── backend/             # Node.js Express API
│   ├── config/          # Configuration files
│   ├── controllers/     # API route controllers
│   ├── middleware/      # Express middleware
│   ├── routes/          # API route definitions
│   ├── utils/           # Utility functions
│   └── server.js        # Express app entry point
├── database/            # Database schemas and migrations
├── frontend/            # Next.js application
│   ├── app/             # Next.js app directory
│   ├── components/      # React components
│   ├── contexts/        # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   └── public/          # Static assets
├── scripts/             # Utility scripts
└── docker-compose.yml   # Docker Compose configuration
```

### TODO
1. Apply transactions for db updates in the backend where necessary.
2. Error Handling: Some components might benefit from more consistent error handling
3. Loading States: Ensure consistent loading indicators across all async operations
4. Form Validation: More comprehensive client-side validation
5. Testing: Unit testing not implemented yet
6. API Documentation: Add OpenAPI/Swagger documentation
7. Input Sanitization: Ensure all user inputs are properly sanitized
8. Caching Strategy: Implement caching for frequently accessed resources
9. Monitoring: Add health check endpoints and performance metrics

## Contributing
We welcome contributions to Ssecura! Please follow these steps to contribute:

1. Fork the repository
2. Create a feature branch (git checkout -b feature/amazing-feature)
3. Commit your changes (git commit -m 'Add some amazing feature')
4. Push to the branch (git push origin feature/amazing-feature)
5. Open a Pull Request

## License
This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support
For support, please open an issue on the GitHub repository.