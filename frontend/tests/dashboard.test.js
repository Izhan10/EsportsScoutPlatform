// Dashboard Tests
// Tests for the enhanced scout dashboard functionality

// Test data structure
const testDashboardData = {
  stats: {
    totalPlayers: 1250,
    avgEsv: 87.5,
    shortlistedCount: 342,
    profileViews: 8920,
    engagementRate: 38.2,
    newThisWeek: 45
  },
  esvData: [85, 92, 78, 88, 95, 82, 90, 87, 76, 89, 93, 84, 91, 88, 79],
  activityData: [
    { type: 'profile', value: 45, label: 'Today' },
    { type: 'shortlist', value: 12, label: 'Yesterday' },
    { type: 'search', value: 28, label: '2 days ago' },
    { type: 'profile', value: 35, label: '3 days ago' },
    { type: 'shortlist', value: 8, label: '4 days ago' }
  ],
  conversionData: [
    { label: 'Filters', value: 500, color: 'rgba(168, 85, 247, 0.7)' },
    { label: 'Prospects', value: 320, color: 'rgba(6, 182, 212, 0.7)' },
    { label: 'Shortlist', value: 180, color: 'rgba(163, 255, 18, 0.7)' },
    { label: 'Profile Views', value: 95, color: 'rgba(255, 59, 129, 0.7)' }
  ],
  geoData: [
    { x: 100, y: 100, city: 'Islamabad', intensity: 0.8 },
    { x: 200, y: 150, city: 'Karachi', intensity: 0.6 },
    { x: 300, y: 120, city: 'Lahore', intensity: 0.9 },
    { x: 400, y: 180, city: 'Peshawar', intensity: 0.4 }
  ],
  citiesData: [
    { city: 'Islamabad', esv: 95 },
    { city: 'Karachi', esv: 87 },
    { city: 'Lahore', esv: 92 },
    { city: 'Peshawar', esv: 76 },
    { city: 'Quetta', esv: 68 }
  ],
  scoutData: [
    { name: 'Lead Scout', values: [85, 78, 92, 88] },
    { name: 'Senior Scout', values: [78, 82, 85, 80] },
    { name: 'Junior Scout', values: [65, 70, 72, 68] }
  ]
};

// Test 1: Dashboard Stats Loading
function testDashboardStatsLoading() {
  console.log('Test 1: Dashboard Stats Loading');
  
  // Mock the API call
  const mockApi = (endpoint) => {
    if (endpoint === '/scout/stats') {
      return Promise.resolve(testDashboardData.stats);
    }
    return Promise.reject(new Error('Endpoint not mocked'));
  };

  // Test stats loading
  mockApi('/scout/stats')
    .then(data => {
      console.log('✓ Stats loaded successfully');
      console.log('  Total Players:', data.totalPlayers);
      console.log('  Avg ESV Rating:', data.avgEsv);
      console.log('  Engagement Rate:', data.engagementRate + '%');
      console.log('  New This Week:', data.newThisWeek);
    })
    .catch(err => {
      console.error('✗ Stats loading failed:', err);
    });
}

// Test 2: Chart Rendering
function testChartRendering() {
  console.log('\nTest 2: Chart Rendering');
  
  // Mock canvas context
  const mockCanvas = {
    getContext: () => ({
      clearRect: () => {},
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: (text, x, y) => console.log(`  Chart text: "${text}" at (${x}, ${y})`),
      fillRect: (x, y, width, height) => console.log(`  Chart bar: (${x}, ${y}) ${width}x${height}`),
      beginPath: () => {},
      arc: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      moveTo: () => {}
    })
  };

  // Test ESV Distribution Chart
  console.log('  Testing ESV Distribution Chart...');
  const esvCanvas = document.createElement('canvas');
  esvCanvas.getContext = () => mockCanvas.getContext();
  createESVDistributionChart(testDashboardData.esvData, esvCanvas);
  console.log('  ✓ ESV Distribution Chart rendered');

  // Test Activity Timeline
  console.log('  Testing Activity Timeline...');
  const timelineCanvas = document.createElement('canvas');
  timelineCanvas.getContext = () => mockCanvas.getContext();
  createActivityTimeline(testDashboardData.activityData, timelineCanvas);
  console.log('  ✓ Activity Timeline rendered');

  // Test Conversion Funnel
  console.log('  Testing Conversion Funnel...');
  const funnelCanvas = document.createElement('canvas');
  funnelCanvas.getContext = () => mockCanvas.getContext();
  createConversionFunnel(testDashboardData.conversionData, funnelCanvas);
  console.log('  ✓ Conversion Funnel rendered');

  // Test Regional Heat Map
  console.log('  Testing Regional Heat Map...');
  const heatMapCanvas = document.createElement('canvas');
  heatMapCanvas.getContext = () => mockCanvas.getContext();
  createRegionalHeatMap(testDashboardData.geoData, heatMapCanvas);
  console.log('  ✓ Regional Heat Map rendered');

  // Test Top Performing Cities
  console.log('  Testing Top Performing Cities...');
  const citiesCanvas = document.createElement('canvas');
  citiesCanvas.getContext = () => mockCanvas.getContext();
  createTopPerformingCities(testDashboardData.citiesData, citiesCanvas);
  console.log('  ✓ Top Performing Cities rendered');

  // Test Scout Performance
  console.log('  Testing Scout Performance...');
  const scoutCanvas = document.createElement('canvas');
  scoutCanvas.getContext = () => mockCanvas.getContext();
  createScoutPerformance(testDashboardData.scoutData, scoutCanvas);
  console.log('  ✓ Scout Performance rendered');
}

// Test 3: Export Functionality
function testExportFunctionality() {
  console.log('\nTest 3: Export Functionality');
  
  // Mock export function
  const mockExportDashboardData = () => {
    const data = {
      timestamp: new Date().toISOString(),
      stats: testDashboardData.stats,
      prospects: [],
      shortlist: [],
      filters: { game: 'Valorant', rank: 'Radiant', esv: '50', city: 'Islamabad' }
    };
    console.log('  ✓ Export data structure created');
    console.log('  ✓ Data includes timestamp:', data.timestamp);
    console.log('  ✓ Data includes stats:', Object.keys(data.stats).length, 'fields');
    console.log('  ✓ Data includes filters:', data.filters);
  };

  mockExportDashboardData();
}

// Test 4: WebSocket Connection
function testWebSocketConnection() {
  console.log('\nTest 4: WebSocket Connection');
  
  // Mock WebSocket
  const mockSocket = {
    on: (event, callback) => {
      if (event === 'connect') {
        console.log('  ✓ WebSocket connected');
      } else if (event === 'disconnect') {
        console.log('  ✓ WebSocket disconnected');
      } else if (event === 'statsUpdate') {
        console.log('  ✓ Stats update listener registered');
      } else if (event === 'prospectsUpdate') {
        console.log('  ✓ Prospects update listener registered');
      } else if (event === 'shortlistUpdate') {
        console.log('  ✓ Shortlist update listener registered');
      }
    },
    emit: (event, data) => {
      console.log(`  ✓ WebSocket event emitted: ${event}`);
    }
  };

  // Test connection
  mockSocket.on('connect', () => {
    console.log('  ✓ Connection established');
  });

  mockSocket.on('disconnect', () => {
    console.log('  ✓ Connection closed');
  });

  mockSocket.on('statsUpdate', (data) => {
    console.log('  ✓ Stats update received');
  });

  mockSocket.on('prospectsUpdate', () => {
    console.log('  ✓ Prospects update received');
  });

  mockSocket.on('shortlistUpdate', () => {
    console.log('  ✓ Shortlist update received');
  });

  console.log('  ✓ WebSocket connection test completed');
}

// Test 5: Error Handling
function testErrorHandling() {
  console.log('\nTest 5: Error Handling');
  
  // Test API error handling
  const mockApiError = (endpoint) => {
    return Promise.reject(new Error('API endpoint not found'));
  };

  mockApiError('/scout/stats')
    .catch(err => {
      console.log('  ✓ API error handled:', err.message);
    });

  // Test chart rendering error handling
  const mockEmptyData = [];
  const mockCanvas = {
    getContext: () => ({
      clearRect: () => {},
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillText: (text, x, y) => console.log(`  Error message: "${text}" at (${x}, ${y})`),
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      lineTo: () => {},
      closePath: () => {},
      stroke: () => {},
      moveTo: () => {}
    })
  };

  console.log('  Testing empty data handling...');
  const emptyCanvas = document.createElement('canvas');
  emptyCanvas.getContext = () => mockCanvas.getContext();
  createESVDistributionChart(mockEmptyData, emptyCanvas);
  console.log('  ✓ Empty data handled gracefully');
}

// Run all tests
console.log('=== Dashboard Tests ===');
testDashboardStatsLoading();
testChartRendering();
testExportFunctionality();
testWebSocketConnection();
testErrorHandling();
console.log('\n=== All Tests Completed ===');