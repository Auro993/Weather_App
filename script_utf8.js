// Configuration
const API_BASE_URL = 'http://localhost:5000/api';
let currentUnits = 'metric';
let currentLocation = { city: 'London', country: 'UK' };
let lastUpdateTime = null;

// DOM Elements
const locationInput = document.getElementById('location-input');
const searchBtn = document.getElementById('search-btn');
const currentLocationBtn = document.getElementById('current-location-btn');
const celsiusBtn = document.getElementById('celsius-btn');
const fahrenheitBtn = document.getElementById('fahrenheit-btn');
const currentWeatherElement = document.getElementById('current-weather');
const forecastContainer = document.getElementById('forecast-container');
const searchResultsElement = document.getElementById('search-results');
const toastElement = document.getElementById('toast');
const lastUpdatedElement = document.getElementById('last-updated');
const apiStatusIcon = document.getElementById('api-status-icon');
const apiStatusText = document.getElementById('api-status-text');

// Weather icon mapping
const weatherIcons = {
    '01d': 'fas fa-sun', '01n': 'fas fa-moon',
    '02d': 'fas fa-cloud-sun', '02n': 'fas fa-cloud-moon',
    '03d': 'fas fa-cloud', '03n': 'fas fa-cloud',
    '04d': 'fas fa-cloud', '04n': 'fas fa-cloud',
    '09d': 'fas fa-cloud-rain', '09n': 'fas fa-cloud-rain',
    '10d': 'fas fa-cloud-rain', '10n': 'fas fa-cloud-rain',
    '11d': 'fas fa-bolt', '11n': 'fas fa-bolt',
    '13d': 'fas fa-snowflake', '13n': 'fas fa-snowflake',
    '50d': 'fas fa-smog', '50n': 'fas fa-smog'
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('WeatherSphere Initializing...');
    
    // Check API connection
    checkApiConnection();
    
    // Load initial weather data
    fetchWeatherData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Auto-refresh every 5 minutes
    setInterval(fetchWeatherData, 300000);
});

// Setup event listeners
function setupEventListeners() {
    // Search button
    searchBtn.addEventListener('click', handleSearch);
    
    // Current location button
    currentLocationBtn.addEventListener('click', getCurrentLocationWeather);
    
    // Unit toggle buttons
    celsiusBtn.addEventListener('click', () => switchUnits('metric'));
    fahrenheitBtn.addEventListener('click', () => switchUnits('imperial'));
    
    // Location input
    locationInput.addEventListener('input', debounce(handleLocationInput, 300));
    locationInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    
    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchResultsElement.contains(e.target) && e.target !== locationInput) {
            searchResultsElement.style.display = 'none';
        }
    });
}

// Check API connection
async function checkApiConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            updateApiStatus(true, 'API: Connected');
        } else {
            updateApiStatus(false, 'API: Error');
        }
    } catch (error) {
        updateApiStatus(false, 'API: Offline');
        showToast('Backend server is not running. Please start the Flask server.', 'error');
    }
}

// Update API status indicator
function updateApiStatus(connected, message) {
    if (connected) {
        apiStatusIcon.style.color = '#2ecc71'; // Green
        apiStatusIcon.className = 'fas fa-circle';
    } else {
        apiStatusIcon.style.color = '#e74c3c'; // Red
        apiStatusIcon.className = 'fas fa-exclamation-circle';
    }
    apiStatusText.textContent = message;
}

// Fetch weather data
async function fetchWeatherData() {
    try {
        showLoading('current');
        showLoading('forecast');
        
        const currentWeather = await fetchCurrentWeather();
        if (currentWeather && !currentWeather.error) {
            displayCurrentWeather(currentWeather);
            lastUpdateTime = new Date();
            updateLastUpdated();
        } else {
            throw new Error(currentWeather?.error || 'Failed to fetch weather');
        }
        
        // Try to fetch forecast (optional)
        try {
            const forecast = await fetchForecast();
            if (forecast && !forecast.error) {
                displayForecast(forecast);
            }
        } catch (forecastError) {
            console.warn('Forecast not available:', forecastError);
            displayForecastPlaceholder();
        }
        
    } catch (error) {
        console.error('Error fetching weather data:', error);
        showToast(`Error: ${error.message}`, 'error');
        displayErrorState();
    } finally {
        hideLoading('current');
        hideLoading('forecast');
    }
}

// Fetch current weather
async function fetchCurrentWeather() {
    const params = new URLSearchParams({
        city: currentLocation.city,
        country: currentLocation.country,
        units: currentUnits
    });
    
    try {
        const response = await fetch(`${API_BASE_URL}/weather/current?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching current weather:', error);
        return { error: 'Unable to fetch weather data' };
    }
}

// Fetch forecast (simplified)
async function fetchForecast() {
    const params = new URLSearchParams({
        city: currentLocation.city,
        country: currentLocation.country,
        units: currentUnits
    });
    
    try {
        const response = await fetch(`${API_BASE_URL}/weather/forecast?${params}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching forecast:', error);
        return { error: 'Forecast not available' };
    }
}

// Display current weather
function displayCurrentWeather(data) {
    const tempUnit = currentUnits === 'metric' ? '°C' : '°F';
    const windUnit = currentUnits === 'metric' ? 'km/h' : 'mph';
    const visibilityUnit = currentUnits === 'metric' ? 'km' : 'miles';
    
    // Update location
    document.getElementById('location-name').textContent = 
        `${data.location.city}, ${data.location.country}`;
    
    // Update date
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('location-date').textContent = 
        now.toLocaleDateString('en-US', options);
    
    // Update temperature
    document.getElementById('current-temp').textContent = data.temperature.current;
    document.getElementById('temp-unit').textContent = tempUnit;
    
    // Update weather icon and description
    const weatherIcon = document.getElementById('weather-icon');
    const iconClass = weatherIcons[data.weather.icon] || 'fas fa-sun';
    weatherIcon.innerHTML = `<i class="${iconClass}"></i>`;
    document.getElementById('weather-desc').textContent = data.weather.description;
    
    // Update details
    document.getElementById('feels-like').textContent = 
        `${data.temperature.feels_like}${tempUnit}`;
    document.getElementById('humidity').textContent = 
        `${data.details.humidity}%`;
    document.getElementById('wind-speed').textContent = 
        `${data.details.wind_speed} ${windUnit}`;
    document.getElementById('pressure').textContent = 
        `${data.details.pressure} hPa`;
    document.getElementById('visibility').textContent = 
        `${data.details.visibility} ${visibilityUnit}`;
    document.getElementById('cloudiness').textContent = 
        `${data.details.cloudiness}%`;
}

// Display forecast
function displayForecast(data) {
    if (!data.forecast || data.forecast.length === 0) {
        displayForecastPlaceholder();
        return;
    }
    
    forecastContainer.innerHTML = '';
    
    data.forecast.forEach(day => {
        const date = new Date(day.datetime);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        const tempUnit = currentUnits === 'metric' ? '°C' : '°F';
        const iconClass = weatherIcons[day.weather.icon] || 'fas fa-sun';
        
        const forecastCard = document.createElement('div');
        forecastCard.className = 'forecast-card';
        forecastCard.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <div class="forecast-date">${monthDay}</div>
            <div class="forecast-icon">
                <i class="${iconClass}"></i>
            </div>
            <div class="weather-description">${day.weather.description}</div>
            <div class="forecast-temp">
                <div class="temp-high">${day.temperature}${tempUnit}</div>
            </div>
            <div class="forecast-details">
                <small>Humidity: ${day.details.humidity}%</small>
                <br>
                <small>Wind: ${day.details.wind_speed} ${currentUnits === 'metric' ? 'km/h' : 'mph'}</small>
            </div>
        `;
        
        forecastContainer.appendChild(forecastCard);
    });
}

// Display forecast placeholder
function displayForecastPlaceholder() {
    forecastContainer.innerHTML = `
        <div class="forecast-placeholder">
            <p><i class="fas fa-info-circle"></i> Forecast feature coming soon</p>
            <p class="small">Basic forecast data is available in the API</p>
        </div>
    `;
}

// Display error state
function displayErrorState() {
    document.getElementById('location-name').textContent = 'Error Loading Data';
    document.getElementById('weather-icon').innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
    document.getElementById('weather-desc').textContent = 'Unable to fetch weather data';
}

// Handle search
function handleSearch() {
    const query = locationInput.value.trim();
    if (!query) {
        showToast('Please enter a city name', 'warning');
        return;
    }
    
    // Simple parsing - expecting "City, Country" format
    const parts = query.split(',').map(part => part.trim());
    currentLocation = {
        city: parts[0],
        country: parts[1] || parts[0].toLowerCase() === 'delhi' ? 'IN' : 'UK'
    };
    
    fetchWeatherData();
    searchResultsElement.style.display = 'none';
}

// Handle location input for autocomplete
async function handleLocationInput() {
    const query = locationInput.value.trim();
    
    if (query.length < 2) {
        searchResultsElement.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/location/search?q=${encodeURIComponent(query)}`);
        const locations = await response.json();
        
        if (locations.length > 0) {
            displaySearchResults(locations);
        } else {
            searchResultsElement.style.display = 'none';
        }
    } catch (error) {
        console.error('Error searching locations:', error);
    }
}

// Display search results
function displaySearchResults(locations) {
    searchResultsElement.innerHTML = '';
    
    locations.forEach(location => {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.innerHTML = `
            <div class="result-name">
                ${location.name}${location.state ? `, ${location.state}` : ''}
            </div>
            <div class="result-country">${location.country}</div>
        `;
        
        div.addEventListener('click', () => {
            currentLocation = {
                city: location.name,
                country: location.country
            };
            locationInput.value = `${location.name}, ${location.country}`;
            searchResultsElement.style.display = 'none';
            fetchWeatherData();
        });
        
        searchResultsElement.appendChild(div);
    });
    
    searchResultsElement.style.display = 'block';
}

// Get current location using geolocation
function getCurrentLocationWeather() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'error');
        return;
    }
    
    showToast('Getting your location...', 'info');
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                
                // For now, we'll use a simple approach
                // In a real app, you would reverse geocode here
                showToast('Please enter your city name manually for now
