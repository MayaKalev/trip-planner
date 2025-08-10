const axios = require('axios');
const { asyncHandler } = require('../middleware/errorHandler');

// @desc    Get weather forecast for location
// @route   GET /api/weather/:location
// @access  Public
// Helper function to get real 3-day weather forecast by coordinates
const getWeatherData = async (startLat, startLng) => {
  try {
    if (!process.env.WEATHER_API_KEY) {
      console.error('❌ WEATHER_API_KEY not set');
      return { forecast: [] };
    }

    console.log(`🔹 Fetching weather for coordinates: ${startLat}, ${startLng}`);

    // Fetch 3-day forecast (8 records per day, every 3 hours)
    const response = await axios.get(
      `https://api.openweathermap.org/data/2.5/forecast`,
      {
        params: {
          lat: startLat,
          lon: startLng,
          appid: process.env.WEATHER_API_KEY,
          units: 'metric',
          cnt: 24
        }
      }
    );

    if (!response.data || !response.data.list) {
      console.error('❌ OpenWeatherMap returned empty response');
      return { forecast: [] };
    }

    const forecastData = response.data.list;
    const forecasts = [];
    const dailyData = {};

    // Group forecasts by day
    forecastData.forEach(forecast => {
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
      dailyData[dayKey].precipitation.push(forecast.pop * 100);
    });

    // Take the next 3 days starting from tomorrow
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    Object.keys(dailyData)
      .filter(dayKey => new Date(dayKey) >= tomorrow)
      .slice(0, 3)
      .forEach(dayKey => {
        const day = dailyData[dayKey];
        forecasts.push({
          date: day.date,
          temperature: {
            min: Math.min(...day.temperatures),
            max: Math.max(...day.temperatures),
            current: day.temperatures[0]
          },
          description: getMostFrequent(day.descriptions),
          icon: day.icons[0],
          humidity: Math.round(day.humidity.reduce((a, b) => a + b, 0) / day.humidity.length),
          windSpeed: Math.round(day.windSpeed.reduce((a, b) => a + b, 0) / day.windSpeed.length * 10) / 10,
          precipitation: Math.round(day.precipitation.reduce((a, b) => a + b, 0) / day.precipitation.length)
        });
      });

    console.log('✅ 3-day weather forecast ready:', forecasts);
    return { forecast: forecasts };

  } catch (error) {
    console.error('❌ Weather data error:', error.message);
    return { forecast: [] };
  }
};

// Helper function to get the most frequent description
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
  getWeatherData
};
