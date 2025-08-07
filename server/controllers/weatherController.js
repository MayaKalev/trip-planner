const axios = require('axios');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get weather forecast for location
// @route   GET /api/weather/:location
// @access  Public
const getWeatherForecast = asyncHandler(async (req, res) => {
  const { location } = req.params;
  const { days = 3 } = req.query;

  if (!process.env.WEATHER_API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'Weather API key not configured'
    });
  }

  try {
    // 1️⃣ Get coordinates for the location
    const geocodeResponse = await axios.get(
      `http://api.openweathermap.org/geo/1.0/direct`,
      {
        params: {
          q: location,
          limit: 1,
          appid: process.env.WEATHER_API_KEY
        }
      }
    );

    if (!geocodeResponse.data || geocodeResponse.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    const { lat, lon, name, country } = geocodeResponse.data[0];

    // 2️⃣ Get weather forecast (3-hour intervals)
    const weatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast`,
      {
        params: {
          lat,
          lon,
          appid: process.env.WEATHER_API_KEY,
          units: 'metric',
          cnt: days * 8 // 8 forecasts per day (every 3 hours)
        }
      }
    );

    // 3️⃣ Process and format weather data
    const forecasts = processWeatherData(weatherResponse.data, days);

    res.json({
      success: true,
      data: {
        location: {
          name,
          country,
          coordinates: { lat, lon }
        },
        forecast: forecasts
      }
    });

  } catch (error) {
    console.error('Weather API error:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      return res.status(500).json({
        success: false,
        message: 'Weather API key is invalid'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Weather API rate limit exceeded'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch weather data'
    });
  }
});

// @desc    Get current weather for location
// @route   GET /api/weather/:location/current
// @access  Public
const getCurrentWeather = asyncHandler(async (req, res) => {
  const { location } = req.params;

  if (!process.env.WEATHER_API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'Weather API key not configured'
    });
  }

  try {
    // 1️⃣ Get coordinates for the location
    const geocodeResponse = await axios.get(
      `http://api.openweathermap.org/geo/1.0/direct`,
      {
        params: {
          q: location,
          limit: 1,
          appid: process.env.WEATHER_API_KEY
        }
      }
    );

    if (!geocodeResponse.data || geocodeResponse.data.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Location not found'
      });
    }

    const { lat, lon, name, country } = geocodeResponse.data[0];

    // 2️⃣ Get current weather
    const weatherResponse = await axios.get(
      `https://api.openweathermap.org/data/2.5/weather`,
      {
        params: {
          lat,
          lon,
          appid: process.env.WEATHER_API_KEY,
          units: 'metric'
        }
      }
    );

    const weather = weatherResponse.data;

    res.json({
      success: true,
      data: {
        location: {
          name,
          country,
          coordinates: { lat, lon }
        },
        current: {
          temperature: {
            current: weather.main.temp,
            feels_like: weather.main.feels_like,
            min: weather.main.temp_min,
            max: weather.main.temp_max
          },
          description: weather.weather[0].description,
          icon: weather.weather[0].icon,
          humidity: weather.main.humidity,
          windSpeed: weather.wind.speed,
          pressure: weather.main.pressure,
          visibility: weather.visibility,
          sunrise: new Date(weather.sys.sunrise * 1000),
          sunset: new Date(weather.sys.sunset * 1000)
        }
      }
    });

  } catch (error) {
    console.error('Weather API error:', error.response?.data || error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch current weather data'
    });
  }
});

// Helper function to process weather data for 3-day forecast
const processWeatherData = (weatherData, days) => {
  const forecasts = [];
  const dailyData = {};

  // Group forecasts by day
  weatherData.list.forEach(forecast => {
    const date = new Date(forecast.dt * 1000);
    const dayKey = date.toISOString().split('T')[0];

    if (!dailyData[dayKey]) {
      dailyData[dayKey] = {
        date: date,
        temperatures: [],
        descriptions: [],
        icons: [],
        humidity: [],
        windSpeed: [],
        precipitation: []
      };
    }

    dailyData[dayKey].temperatures.push(forecast.main.temp);
    dailyData[dayKey].descriptions.push(forecast.weather[0].description);
    dailyData[dayKey].icons.push(forecast.weather[0].icon);
    dailyData[dayKey].humidity.push(forecast.main.humidity);
    dailyData[dayKey].windSpeed.push(forecast.wind.speed);
    dailyData[dayKey].precipitation.push(forecast.pop * 100); // Convert to %
  });

  // Process first 3 days
  Object.keys(dailyData).slice(0, days).forEach(dayKey => {
    const day = dailyData[dayKey];
    const temperatures = day.temperatures;
    const descriptions = day.descriptions;

    forecasts.push({
      date: day.date,
      temperature: {
        min: Math.min(...temperatures),
        max: Math.max(...temperatures),
        current: temperatures[0] // first forecast of the day
      },
      description: getMostFrequent(descriptions),
      icon: day.icons[0],
      humidity: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
      windSpeed: Math.round(day.windSpeed.reduce((a, b) => a + b, 0) / day.windSpeed.length * 10) / 10,
      precipitation: Math.round(day.precipitation.reduce((a, b) => a + b, 0) / day.precipitation.length)
    });
  });

  return forecasts;
};

// Helper function to get the most frequent array item
const getMostFrequent = (arr) => {
  const frequency = {};
  let maxFreq = 0;
  let mostFrequent = arr[0];

  arr.forEach(item => {
    frequency[item] = (frequency[item] || 0) + 1;
    if (frequency[item] > maxFreq) {
      maxFreq = frequency[item];
      mostFrequent = item;
    }
  });

  return mostFrequent;
};

module.exports = {
  getWeatherForecast,
  getCurrentWeather
};
