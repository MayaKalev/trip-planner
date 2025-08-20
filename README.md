Trip Planner AI - README

**Authors:**  
- Roni Arviv - 206395642  
- Maya Kalev - 212212856  

---

## Overview
Trip Planner AI is an end-to-end project for planning intelligent travel routes using **React** on the client side and **Node.js Express** on the server side.  
The system generates realistic hiking or cycling routes around a user-selected destination, adjusts them to road and trail networks, displays real-time weather forecasts for the next three days, and allows saving routes to a personal account.

---

## Features
- User authentication: registration, login, logout, and profile management with **JWT**.  
- Hiking route planning: circular, single-day, **5–15 km**.  
- Cycling route planning: non-circular, two-day, up to **60 km/day**.  
- Realistic route adjustment with **OpenRouteService**.  
- Filtering of straight-line routes to avoid unrealistic results.  
- Real-time **3-day weather forecast** based on starting coordinates.  
- Destination image from the internet (or default fallback).  
- CRUD operations for routes: save, view, update, and delete.  
- Interactive maps with **Leaflet** displaying routes per day with `Polyline`.  

---

## Project Structure

```
📂 trip-planner1-main/
│
├── 📂 client/                # Frontend (React)
│   ├── 📂 public/             # Static HTML (main index.html)
│   ├── 📂 src/
│   │   ├── 📂 components/     # Reusable UI components (Navbar, LocationSearch, WeatherCard, RouteMap, LoadingSpinner)
│   │   ├── 📂 contexts/       # Global State (AuthContext)
│   │   ├── 📂 pages/          # App pages (Home, Login, Profile, Register, SavedRoutes, TripPlanner)
│   │   ├── 📂 services/       # API services (authService, routeService, tripService, weatherService)
│   │   ├── index.js           # App entry point
│   │   └── index.css          # Styling (TailwindCSS)
│   │   └── App.js          # Root component
│   └── tailwind.config.js     # TailwindCSS configuration
│
├── 📂 server/                # Backend (Node.js + Express)
│   ├── 📂 routes/             # API routes (auth, routes, trip)
│   ├── 📂 controllers/        # Request handling logic
│   ├── 📂 models/             # Mongoose models
│   ├── 📂 middleware/         # JWT auth, error handling, validations
│   └── server.js              # Server entry point
│
├── .gitignore                 # Git ignore rules
├── README.md                  # Project documentation
└── setup.ps1                  # Quick setup PowerShell script
```

---

##  Technologies

**Frontend:** React, React Router, TailwindCSS, Leaflet, Axios, react-hot-toast  
**Backend:** Node.js, Express, Mongoose, JWT, express-validator  
**Database:** MongoDB  
**Third-Party APIs:**  
- OpenRouteService → route generation  
- OpenWeatherMap → weather forecast  
- Unsplash → destination images  
- Groq LLM → waypoint generation  

---

##  Installation & Setup

### Requirements
- Node.js v18+  
- npm or yarn  
- MongoDB (local or cloud)  
- API keys:  
  - `OPENROUTESERVICE_API_KEY`  
  - `WEATHER_API_KEY` (OpenWeatherMap)  
  - `GROQ_API_KEY`  
  - `UNSPLASH_ACCESS_KEY` (optional)
  

---

### Environment Files

Create **two `.env` files**, one for server and one for client.

#### `server/.env`
```env
PORT=5001
NODE_ENV=development
CLIENT_URL=http://localhost:3000

MONGODB_URI=mongodb://localhost:27017/trip-planner

JWT_SECRET=change_me
JWT_EXPIRE=7d

OPENROUTESERVICE_API_KEY=your_ors_key
WEATHER_API_KEY=your_openweather_key
GROQ_API_KEY=your_groq_key
UNSPLASH_ACCESS_KEY=your_unsplash_key


```

#### `client/.env`
```env
REACT_APP_API_URL=http://localhost:5001/api
```

---

### Quick Setup (Windows PowerShell)
From the project root:
```powershell
.\setup.ps1
```
This installs dependencies, checks `.env` files, and prints next steps.  
⚠️ API keys must still be added manually.

---

### Manual Run
Open **two terminals**:

**Server**  
```bash
cd server
npm install
npm run dev   # or npm start
```

**Client**  
```bash
cd client
npm install
npm start
```

Default:  
- Client → [http://localhost:3000](http://localhost:3000)  
- Server → [http://localhost:5001](http://localhost:5001)  

---

## 🔄 Workflow

1. User registers/logs in → server returns JWT → stored in `localStorage`.  
2. User selects destination via `LocationSearch`.  
3. Client sends `POST /api/trip/plan` with destination + trip type.  
4. Server generates **waypoints** with LLM.  
5. Waypoints sent to **OpenRouteService** → realistic GeoJSON route.  
6. Server fetches **3-day weather forecast** + image.  
7. Client displays map, forecast, and image.  
8. User can save route (stored in DB).  

---

## 🌐 External Integrations
- **OpenRouteService** → `/v2/directions` (`foot-hiking`, `cycling-regular`)  
- **OpenWeatherMap** → 3-day forecast  
- **Unsplash** → destination image search  
- **Groq LLM** → JSON-only waypoints  

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register`  
- `POST /api/auth/login`  
- `GET /api/auth/me` (JWT required)  
- `PUT /api/auth/profile` (JWT required)  
- `PUT /api/auth/password` (JWT required)  

### Routes (Saved)
- `GET /api/routes` → user’s routes (with pagination & filtering)  
- `GET /api/routes/:id` → route details (with geometry/dailyRoutes & center)  
- `POST /api/routes` → create new route  
- `PUT /api/routes/:id` → update route (re-normalization if data replaced)  
- `DELETE /api/routes/:id` → delete route  

### Trip Planning
- `POST /api/trip/plan` (JWT required)  
  **Request body:**  
  ```json
  {
    "location": { "name": "Berlin Germany", "lat": 52.52, "lng": 13.405 },
    "tripType": "hiking"
  }
  ```
  **Response:**  
  ```json
  {
    "route": { "geometry": {...}, "dailyRoutes": [...], "totalDistance": 12345, "totalDuration": 3600 },
    "weather": { "forecast": [ ... ] },
    "image": { "url": "..." }
  }
  ```

### Weather & Image
- Weather is always real-time, fetched with `getWeatherData(lat, lng)`.  
- Destination image via: `GET /api/image?location=`.  

---

## Database Models

### User
- `name`, `email` (unique)  
- `password` (hashed)  
- `isActive`, `lastLogin`  
- Methods: `matchPassword`, `getPublicProfile`  

### Route
- `user` (ref)  
- `name`, `description`, `tripType` (hiking/cycling)  
- `location`: city, country, coordinates  
- `routeData`: geometry/dailyRoutes, totalDistance, totalDuration  
- `image`  
- `tags`, `notes`  
- Virtuals: readable distance & duration  

---
