import React from 'react';
import { Calendar, Thermometer, Droplets, Wind } from 'lucide-react';

const WeatherCard = ({ weather, location }) => {
  if (!weather || !weather.forecast) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Weather Forecast</h3>
        </div>
        <div className="card-body">
          <p className="text-gray-500">Weather data not available</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getWeatherIcon = (iconCode) => {
    const iconMap = {
      '01d': '☀️',
      '01n': '🌙',
      '02d': '⛅',
      '02n': '☁️',
      '03d': '☁️',
      '03n': '☁️',
      '04d': '☁️',
      '04n': '☁️',
      '09d': '🌧️',
      '09n': '🌧️',
      '10d': '🌦️',
      '10n': '🌧️',
      '11d': '⛈️',
      '11n': '⛈️',
      '13d': '❄️',
      '13n': '❄️',
      '50d': '🌫️',
      '50n': '🌫️'
    };
    return iconMap[iconCode] || '🌤️';
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900">Weather Forecast</h3>
        {location && (
          <p className="text-sm text-gray-600 mt-1">
            {location.name}, {location.country}
          </p>
        )}
      </div>
      <div className="card-body">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {weather.forecast.map((day, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {formatDate(day.date)}
                  </span>
                </div>
                <span className="text-2xl">
                  {getWeatherIcon(day.icon)}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-gray-600">High</span>
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(day.temperature.max)}°C
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Thermometer className="h-4 w-4 text-blue-500" />
                    <span className="text-sm text-gray-600">Low</span>
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(day.temperature.min)}°C
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Droplets className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-gray-600">Rain</span>
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(day.precipitation)}%
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Wind className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Wind</span>
                  </div>
                  <span className="text-sm font-medium">
                    {day.windSpeed} m/s
                  </span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-700 capitalize">
                  {day.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeatherCard; 