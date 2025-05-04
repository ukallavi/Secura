/**
 * Error Analytics Dashboard
 * Provides visualizations and insights into error patterns
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminApi } from '@/lib/api-client';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  PointElement, 
  LineElement, 
  BarElement,
  Title, 
  Tooltip, 
  Legend, 
  ArcElement,
  TimeScale
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import AdminLayout from '@/components/layouts/admin-layout';
import ErrorTypeFilter from '@/components/admin/error-type-filter';
import DateRangePicker from '@/components/admin/date-range-picker';
import EnvironmentSelector from '@/components/admin/environment-selector';
import ServiceSelector from '@/components/admin/service-selector';
import Spinner from '@/components/ui/spinner';
import { formatDate, getRelativeTimeString } from '@/lib/date-utils';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale
);

export default function ErrorAnalyticsDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [timeRange, setTimeRange] = useState('7d'); // Default to 7 days
  const [errorTypes, setErrorTypes] = useState([]);
  const [selectedErrorTypes, setSelectedErrorTypes] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState('all');
  const [services, setServices] = useState([]);
  const [selectedService, setSelectedService] = useState('all');
  
  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        
        // Fetch available filters first
        const filtersResponse = await AdminApi.getErrorFilters();
        setErrorTypes(filtersResponse.errorTypes || []);
        setEnvironments(filtersResponse.environments || []);
        setServices(filtersResponse.services || []);
        
        // If no error types are selected, select all
        if (selectedErrorTypes.length === 0 && filtersResponse.errorTypes) {
          setSelectedErrorTypes(filtersResponse.errorTypes);
        }
        
        // Fetch analytics data with filters
        const analyticsResponse = await AdminApi.getErrorAnalytics({
          timeRange,
          errorTypes: selectedErrorTypes.length > 0 ? selectedErrorTypes : undefined,
          environment: selectedEnvironment !== 'all' ? selectedEnvironment : undefined,
          service: selectedService !== 'all' ? selectedService : undefined
        });
        
        setAnalytics(analyticsResponse);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch error analytics:', err);
        setError('Failed to load analytics data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [timeRange, selectedErrorTypes, selectedEnvironment, selectedService]);
  
  // Handle filter changes
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
  };
  
  const handleErrorTypeChange = (types) => {
    setSelectedErrorTypes(types);
  };
  
  const handleEnvironmentChange = (env) => {
    setSelectedEnvironment(env);
  };
  
  const handleServiceChange = (service) => {
    setSelectedService(service);
  };
  
  // Prepare chart data
  const getErrorTrendData = () => {
    if (!analytics || !analytics.trends) return null;
    
    return {
      labels: analytics.trends.map(point => new Date(point.date)),
      datasets: [
        {
          label: 'Error Count',
          data: analytics.trends.map(point => point.count),
          borderColor: 'rgb(255, 99, 132)',
          backgroundColor: 'rgba(255, 99, 132, 0.5)',
          tension: 0.2
        }
      ]
    };
  };
  
  const getErrorTypeDistributionData = () => {
    if (!analytics || !analytics.byType) return null;
    
    return {
      labels: analytics.byType.map(item => item.type),
      datasets: [
        {
          label: 'Errors by Type',
          data: analytics.byType.map(item => item.count),
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)',
            'rgba(199, 199, 199, 0.6)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(199, 199, 199, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
  };
  
  const getErrorsByEnvironmentData = () => {
    if (!analytics || !analytics.byEnvironment) return null;
    
    return {
      labels: analytics.byEnvironment.map(item => item.environment),
      datasets: [
        {
          label: 'Errors by Environment',
          data: analytics.byEnvironment.map(item => item.count),
          backgroundColor: [
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 99, 132, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)'
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
  };
  
  const getErrorsByServiceData = () => {
    if (!analytics || !analytics.byService) return null;
    
    return {
      labels: analytics.byService.map(item => item.service),
      datasets: [
        {
          label: 'Errors by Service',
          data: analytics.byService.map(item => item.count),
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1
        }
      ]
    };
  };
  
  // Chart options
  const trendOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeRange === '24h' ? 'hour' : 
                timeRange === '7d' ? 'day' : 
                timeRange === '30d' ? 'day' : 'week'
        },
        title: {
          display: true,
          text: 'Date'
        }
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Error Count'
        }
      }
    },
    plugins: {
      title: {
        display: true,
        text: 'Error Trend Over Time',
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          title: function(context) {
            return formatDate(new Date(context[0].parsed.x));
          }
        }
      }
    }
  };
  
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right'
      },
      title: {
        display: true,
        text: 'Error Distribution by Type',
        font: {
          size: 16
        }
      }
    }
  };
  
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Errors by Environment',
        font: {
          size: 16
        }
      }
    }
  };
  
  const serviceBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true
      }
    },
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Errors by Service',
        font: {
          size: 16
        }
      }
    }
  };
  
  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Error Analytics Dashboard</h1>
        
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Time Range</h3>
              <DateRangePicker 
                value={timeRange} 
                onChange={handleTimeRangeChange} 
                options={[
                  { value: '24h', label: 'Last 24 Hours' },
                  { value: '7d', label: 'Last 7 Days' },
                  { value: '30d', label: 'Last 30 Days' },
                  { value: '90d', label: 'Last 90 Days' }
                ]}
              />
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Error Types</h3>
              <ErrorTypeFilter 
                errorTypes={errorTypes} 
                selectedTypes={selectedErrorTypes} 
                onChange={handleErrorTypeChange} 
              />
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Environment</h3>
              <EnvironmentSelector 
                environments={['all', ...environments]} 
                selectedEnvironment={selectedEnvironment} 
                onChange={handleEnvironmentChange} 
              />
            </div>
            
            <div>
              <h3 className="text-sm font-medium mb-2">Service</h3>
              <ServiceSelector 
                services={['all', ...services]} 
                selectedService={selectedService} 
                onChange={handleServiceChange} 
              />
            </div>
          </div>
        </div>
        
        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center h-64">
            <Spinner size="lg" />
          </div>
        )}
        
        {/* Error state */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            <p>{error}</p>
          </div>
        )}
        
        {/* Analytics content */}
        {!loading && !error && analytics && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-sm font-medium text-gray-500">Total Errors</h3>
                <p className="text-3xl font-bold">{analytics.totalErrors}</p>
                <p className="text-sm text-gray-500">
                  {timeRange === '24h' ? 'Last 24 hours' : 
                   timeRange === '7d' ? 'Last 7 days' : 
                   timeRange === '30d' ? 'Last 30 days' : 'Last 90 days'}
                </p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-sm font-medium text-gray-500">Critical Errors</h3>
                <p className="text-3xl font-bold text-red-600">{analytics.criticalErrors}</p>
                <p className="text-sm text-gray-500">
                  {analytics.criticalErrorsPercentage}% of total
                </p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-sm font-medium text-gray-500">Most Common Error</h3>
                <p className="text-xl font-bold truncate">{analytics.mostCommonError?.type || 'N/A'}</p>
                <p className="text-sm text-gray-500">
                  {analytics.mostCommonError?.count || 0} occurrences
                </p>
              </div>
              
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-sm font-medium text-gray-500">Latest Error</h3>
                <p className="text-xl font-bold truncate">{analytics.latestError?.type || 'N/A'}</p>
                <p className="text-sm text-gray-500">
                  {analytics.latestError?.timestamp ? 
                    getRelativeTimeString(new Date(analytics.latestError.timestamp)) : 'N/A'}
                </p>
              </div>
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Error trend chart */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="h-80">
                  {getErrorTrendData() ? (
                    <Line data={getErrorTrendData()} options={trendOptions} />
                  ) : (
                    <div className="flex justify-center items-center h-full">
                      <p className="text-gray-500">No trend data available</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Error type distribution chart */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="h-80">
                  {getErrorTypeDistributionData() ? (
                    <Pie data={getErrorTypeDistributionData()} options={pieOptions} />
                  ) : (
                    <div className="flex justify-center items-center h-full">
                      <p className="text-gray-500">No error type data available</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Errors by environment chart */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="h-80">
                  {getErrorsByEnvironmentData() ? (
                    <Bar data={getErrorsByEnvironmentData()} options={barOptions} />
                  ) : (
                    <div className="flex justify-center items-center h-full">
                      <p className="text-gray-500">No environment data available</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Errors by service chart */}
              <div className="bg-white rounded-lg shadow-md p-4">
                <div className="h-80">
                  {getErrorsByServiceData() ? (
                    <Bar data={getErrorsByServiceData()} options={serviceBarOptions} />
                  ) : (
                    <div className="flex justify-center items-center h-full">
                      <p className="text-gray-500">No service data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* View all errors button */}
            <div className="flex justify-center mt-6">
              <button
                onClick={() => router.push('/admin/error-monitoring')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                View All Errors
              </button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
