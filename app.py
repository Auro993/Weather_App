from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing for frontend

# Get API key from environment variable
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', 'your_api_key_here')

def get_weather_icon(weather_code):
    """Map OpenWeatherMap icon codes to Font Awesome classes"""
    icon_map = {
        '01d': 'sun', '01n': 'moon',          # clear sky
        '02d': 'cloud-sun', '02n': 'cloud-moon',  # few clouds
        '03d': 'cloud', '03n': 'cloud',       # scattered clouds
        '04d': 'cloud', '04n': 'cloud',       # broken clouds
        '09d': 'cloud-rain', '09n': 'cloud-rain',  # shower rain
        '10d': 'cloud-rain', '10n': 'cloud-rain',  # rain
        '11d': 'bolt', '11n': 'bolt',         # thunderstorm
        '13d': 'snowflake', '13n': 'snowflake',  # snow
        '50d': 'smog', '50n': 'smog'          # mist
    }
    return icon_map.get(weather_code, 'sun')

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify API is running"""
    return jsonify({
        'status': 'healthy',
        'service': 'Weather API',
        'version': '1.0.0'
    })

@app.route('/api/weather/current', methods=['GET'])
def get_current_weather():
    """
    Get current weather data for a location
    Parameters:
    - city: City name (default: London)
    - country: Country code (default: UK)
    - units: Temperature units - metric, imperial, or standard (default: metric)
    """
    city = request.args.get('city', 'London')
    country = request.args.get('country', 'UK')
    units = request.args.get('units', 'metric')
    
    try:
        # OpenWeatherMap API endpoint
        url = "http://api.openweathermap.org/data/2.5/weather"
        
        # Prepare query parameters
        params = {
            'q': f"{city},{country}",
            'appid': OPENWEATHER_API_KEY,
        }
        
        # Add units if not standard (standard uses Kelvin)
        if units != 'standard':
            params['units'] = units
        
        # Make API request
        response = requests.get(url, params=params)
        response.raise_for_status()  # Raise exception for HTTP errors
        
        data = response.json()
        
        # Process and structure the response
        weather_data = {
            'location': {
                'city': data['name'],
                'country': data['sys']['country'],
                'coordinates': {
                    'lat': data['coord']['lat'],
                    'lon': data['coord']['lon']
                }
            },
            'temperature': {
                'current': round(data['main']['temp'], 1),
                'feels_like': round(data['main']['feels_like'], 1),
                'min': round(data['main']['temp_min'], 1),
                'max': round(data['main']['temp_max'], 1),
                'unit': '°C' if units == 'metric' else '°F'
            },
            'weather': {
                'main': data['weather'][0]['main'],
                'description': data['weather'][0]['description'].capitalize(),
                'icon': data['weather'][0]['icon'],
                'icon_class': get_weather_icon(data['weather'][0]['icon'])
            },
            'details': {
                'humidity': data['main']['humidity'],
                'pressure': data['main']['pressure'],
                'wind_speed': round(data['wind']['speed'], 1),
                'wind_deg': data['wind'].get('deg', 0),
                'cloudiness': data['clouds']['all'],
                'visibility': round(data.get('visibility', 10000) / 1000, 1) if units == 'metric' else round(data.get('visibility', 10000) / 1609.34, 1)
            },
            'system': {
                'sunrise': data['sys']['sunrise'],
                'sunset': data['sys']['sunset'],
                'timezone': data['timezone']
            }
        }
        
        return jsonify(weather_data)
        
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'Weather API request failed: {str(e)}'}), 500
    except KeyError as e:
        return jsonify({'error': f'Invalid response format from weather API: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

@app.route('/api/weather/forecast', methods=['GET'])
def get_forecast():
    """Get 5-day weather forecast (simplified version)"""
    city = request.args.get('city', 'London')
    country = request.args.get('country', 'UK')
    units = request.args.get('units', 'metric')
    
    try:
        url = "http://api.openweathermap.org/data/2.5/forecast"
        params = {
            'q': f"{city},{country}",
            'appid': OPENWEATHER_API_KEY,
            'cnt': 5  # Number of timestamps (simplified to 5)
        }
        
        if units != 'standard':
            params['units'] = units
        
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        
        # Process forecast data
        forecast = []
        for item in data['list'][:5]:  # Take first 5 forecasts
            forecast.append({
                'datetime': item['dt_txt'],
                'temperature': round(item['main']['temp'], 1),
                'feels_like': round(item['main']['feels_like'], 1),
                'weather': {
                    'main': item['weather'][0]['main'],
                    'description': item['weather'][0]['description'].capitalize(),
                    'icon': item['weather'][0]['icon'],
                    'icon_class': get_weather_icon(item['weather'][0]['icon'])
                },
                'details': {
                    'humidity': item['main']['humidity'],
                    'wind_speed': round(item['wind']['speed'], 1)
                }
            })
        
        return jsonify({
            'location': {
                'city': data['city']['name'],
                'country': data['city']['country']
            },
            'forecast': forecast,
            'units': units
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/location/search', methods=['GET'])
def search_location():
    """Search for locations by name"""
    query = request.args.get('q', '')

    if not query or len(query) < 2:
        return jsonify([])

    try:
        # Using OpenWeatherMap's geocoding API
        url = "http://api.openweathermap.org/geo/1.0/direct"
        params = {
            'q': query,
            'limit': 5,
            'appid': OPENWEATHER_API_KEY
        }

        response = requests.get(url, params=params)
        response.raise_for_status()
        locations = response.json()

        processed_locations = []
        for loc in locations:
            processed_locations.append({
                'name': loc.get('name', ''),
                'state': loc.get('state', ''),
                'country': loc.get('country', ''),
                'lat': loc.get('lat'),
                'lon': loc.get('lon')
            })

        return jsonify(processed_locations)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/location/reverse', methods=['GET'])
def reverse_geocode():
    """Reverse geocode coordinates to get location name"""
    lat = request.args.get('lat')
    lon = request.args.get('lon')

    if not lat or not lon:
        return jsonify({'error': 'Latitude and longitude are required'}), 400

    try:
        # Using OpenWeatherMap's reverse geocoding API
        url = "http://api.openweathermap.org/geo/1.0/reverse"
        params = {
            'lat': lat,
            'lon': lon,
            'limit': 1,
            'appid': OPENWEATHER_API_KEY
        }

        response = requests.get(url, params=params)
        response.raise_for_status()
        locations = response.json()

        if locations:
            loc = locations[0]
            return jsonify({
                'name': loc.get('name', ''),
                'state': loc.get('state', ''),
                'country': loc.get('country', ''),
                'lat': loc.get('lat'),
                'lon': loc.get('lon')
            })
        else:
            return jsonify({'error': 'No location found for these coordinates'}), 404

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/test', methods=['GET'])
def test_endpoint():
    """Test endpoint with example usage"""
    return jsonify({
        'message': 'Weather API is working correctly!',
        'endpoints': {
            'health': '/api/health',
            'current_weather': '/api/weather/current?city=London&country=UK',
            'forecast': '/api/weather/forecast?city=London',
            'location_search': '/api/location/search?q=London',
            'test': '/api/test'
        },
        'example_queries': [
            'http://localhost:5000/api/weather/current?city=London',
            'http://localhost:5000/api/weather/current?city=Delhi&country=IN',
            'http://localhost:5000/api/weather/current?city=New York&country=US&units=imperial'
        ]
    })

@app.route('/')
def index():
    """Root endpoint - redirect to test endpoint"""
    return """
    <html>
        <head>
            <title>Weather API</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #333; }
                code { background: #f4f4f4; padding: 5px; border-radius: 3px; }
                a { color: #007bff; text-decoration: none; }
                a:hover { text-decoration: underline; }
            </style>
        </head>
        <body>
            <h1>🌤️ Weather API</h1>
            <p>Backend is running successfully!</p>
            <p>Available endpoints:</p>
            <ul>
                <li><a href="/api/health">/api/health</a> - Health check</li>
                <li><a href="/api/test">/api/test</a> - Test endpoint with examples</li>
                <li><code>/api/weather/current?city=London</code> - Current weather</li>
                <li><code>/api/weather/forecast?city=London</code> - 5-day forecast</li>
                <li><code>/api/location/search?q=London</code> - Location search</li>
            </ul>
            <p>To use the frontend, open <code>frontend/index.html</code> in a browser.</p>
        </body>
    </html>
    """

if __name__ == '__main__':
    print("🌤️ Starting Weather API Server...")
    print("📡 API Key Status:", "Loaded" if OPENWEATHER_API_KEY != 'your_api_key_here' else "⚠️  Please update .env file with your API key")
    print("🌐 Server will run on: http://localhost:5000")
    print("📝 Available endpoints:")
    print("   - http://localhost:5000/ (This page)")
    print("   - http://localhost:5000/api/health")
    print("   - http://localhost:5000/api/test")
    print("   - http://localhost:5000/api/weather/current?city=London")
    print("\nPress CTRL+C to stop the server")
    app.run(debug=True, port=5000)