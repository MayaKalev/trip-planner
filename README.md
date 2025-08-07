# Personal Trip Planner

A full-stack web application that allows registered users to plan trip routes, save them, view their trip history, and receive relevant information such as weather forecasts.

## Features

### MVP Features
- **User Authentication**: Registration, login, logout with JWT tokens
- **Trip Planning**: Create cycling and hiking routes with interactive maps
- **Route Management**: Save, view, and manage personal trip routes
- **Weather Integration**: 3-day weather forecasts for trip locations
- **Interactive Maps**: Leaflet.js integration for route visualization

### Technical Stack
- **Frontend**: React.js with HTML5, CSS3, JavaScript (ES6)
- **Backend**: Node.js + Express.js
- **Database**: MongoDB (NoSQL)
- **Authentication**: JWT tokens with password hashing
- **Maps**: Leaflet.js for interactive mapping
- **Weather API**: OpenWeatherMap integration
- **Route Generation**: AI-powered route suggestions

## Project Structure

```
Trip/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── utils/         # Utility functions
│   │   └── styles/        # CSS styles
│   └── package.json
├── server/                 # Node.js backend
│   ├── config/            # Configuration files
│   ├── controllers/       # Route controllers
│   ├── middleware/        # Custom middleware
│   ├── models/           # MongoDB models
│   ├── routes/           # API routes
│   ├── utils/            # Utility functions
│   └── package.json
├── .env.example          # Environment variables template
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn package manager

## Installation & Setup

### 1. Clone and Setup
```bash
# Clone the repository
git clone <repository-url>
cd Trip

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
# Required variables:
# - MONGODB_URI: Your MongoDB connection string
# - JWT_SECRET: Secret key for JWT tokens
# - WEATHER_API_KEY: OpenWeatherMap API key
# - PORT: Server port (default: 5000)
```

### 3. Database Setup
- Set up MongoDB locally or use MongoDB Atlas
- Update MONGODB_URI in .env file
- Database and collections will be created automatically

### 4. API Keys Required
- **OpenWeatherMap API Key**: Get free API key from [OpenWeatherMap](https://openweathermap.org/api)
- **JWT Secret**: Generate a secure random string for JWT token signing

### 5. Running the Application

#### Development Mode
```bash
# Terminal 1: Start backend server
cd server
npm run dev

# Terminal 2: Start frontend development server
cd client
npm start
```

#### Production Mode
```bash
# Build frontend
cd client
npm run build

# Start production server
cd ../server
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user (protected)

### Routes
- `GET /api/routes` - Get user's saved routes (protected)
- `POST /api/routes` - Save new route (protected)
- `GET /api/routes/:id` - Get specific route (protected)
- `DELETE /api/routes/:id` - Delete route (protected)

### Weather
- `GET /api/weather/:location` - Get weather forecast for location

### Trip Planning
- `POST /api/plan-trip` - Generate trip route with AI

## Usage

### 1. User Registration/Login
- Navigate to the application
- Register with email, name, and password
- Login with credentials
- JWT token is automatically managed

### 2. Trip Planning
- Select country/region/city
- Choose trip type (Hiking or Cycling)
- View generated route on interactive map
- See weather forecast for next 3 days
- Save route with custom name and description

### 3. Route Management
- View all saved routes in history
- Click on route to load on map
- Delete unwanted routes
- View route details and weather

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Protected routes and user-specific data
- Input validation and sanitization
- CORS configuration

## Known Issues

- Weather API has rate limits (free tier: 60 calls/minute)
- Route generation depends on external AI service availability
- Map tiles may have loading delays in some regions

## Development Notes

- All API calls use fetch with proper error handling
- React components are functional with hooks
- MongoDB schemas include proper validation
- Code includes comprehensive error handling
- Responsive design for mobile and desktop

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with proper testing
4. Submit pull request

## License

This project is created for educational purposes as part of a full-stack development course. 