/**
 * Tests for ErrorBoundary component
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ErrorBoundary from '../../components/ErrorBoundary';
import { ErrorTrackingProvider } from '../../contexts/ErrorTrackingContext';

// Mock the error tracking context
jest.mock('../../contexts/ErrorTrackingContext', () => {
  const originalModule = jest.requireActual('../../contexts/ErrorTrackingContext');
  
  return {
    ...originalModule,
    ErrorTrackingProvider: ({ children }) => children,
    useErrorTracking: jest.fn(() => ({
      reportError: jest.fn(),
      isEnabled: true
    }))
  };
});

// Mock the API client
jest.mock('../../lib/api-client', () => ({
  reportError: jest.fn(() => Promise.resolve({ success: true }))
}));

// Component that throws an error
const ErrorThrowingComponent = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary Component', () => {
  // Suppress console errors for expected error throws in tests
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });
  
  afterAll(() => {
    console.error = originalConsoleError;
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child Component</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Child Component')).toBeInTheDocument();
  });
  
  test('should render fallback UI when an error occurs', () => {
    // We need to spy on console.error and suppress it for this test
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary>
        <ErrorThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );
    
    // Check that the error message is displayed
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    
    // Check that the retry button is displayed
    expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument();
    
    // Restore console.error
    errorSpy.mockRestore();
  });
  
  test('should retry rendering children when retry button is clicked', () => {
    // We need to create a component that can toggle the error state
    const TestComponent = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      
      React.useEffect(() => {
        // Mock the retry action by setting shouldThrow to false after the component mounts
        const handleRetry = () => {
          setShouldThrow(false);
        };
        
        // Add a global event listener for our custom retry event
        window.addEventListener('retry-error-boundary', handleRetry);
        
        return () => {
          window.removeEventListener('retry-error-boundary', handleRetry);
        };
      }, []);
      
      if (shouldThrow) {
        throw new Error('Test error');
      }
      
      return <div data-testid="recovered">Component recovered</div>;
    };
    
    // We need to spy on console.error and suppress it for this test
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    );
    
    // Check that the error message is displayed
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    
    // Click the retry button
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }));
    
    // Dispatch our custom event to simulate the retry action
    window.dispatchEvent(new Event('retry-error-boundary'));
    
    // Check that the component has recovered
    expect(screen.getByTestId('recovered')).toBeInTheDocument();
    expect(screen.getByText('Component recovered')).toBeInTheDocument();
    
    // Restore console.error
    errorSpy.mockRestore();
  });
  
  test('should report errors to the error tracking system', () => {
    // We need to spy on console.error and suppress it for this test
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const { useErrorTracking } = require('../../contexts/ErrorTrackingContext');
    const mockReportError = jest.fn();
    useErrorTracking.mockReturnValue({
      reportError: mockReportError,
      isEnabled: true
    });
    
    render(
      <ErrorTrackingProvider>
        <ErrorBoundary>
          <ErrorThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      </ErrorTrackingProvider>
    );
    
    // Check that reportError was called with the error
    expect(mockReportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error_type: 'REACT_ERROR',
        error_message: 'Test error'
      })
    );
    
    // Restore console.error
    errorSpy.mockRestore();
  });
});
