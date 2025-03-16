/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    logger.error(err.stack);
    
    // Default error status and message
    const status = err.statusCode || 500;
    const message = err.message || 'Something went wrong on the server.';
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    
    if (err.name === 'UnauthorizedError') {
      return res.status(401).json({ message: 'Invalid token.' });
    }
    
    // Generic error response
    res.status(status).json({
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  };
  
  module.exports = {
    errorHandler
  };