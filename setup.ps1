Write-Host "Setting up Personal Trip Planner Application"
Write-Host "================================================"

# 1. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js is not installed. Please install Node.js (v14 or higher)."
    exit
}

# 2. Check Node.js version
$nodeVersion = node -v
$majorVersion = $nodeVersion.TrimStart('v').Split('.')[0]
if ([int]$majorVersion -lt 14) {
    Write-Host "Node.js version 14 or higher is required. Current version: $nodeVersion"
    exit
}

Write-Host "Node.js version: $nodeVersion"

# 3. Check npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm is not installed. Please install npm first."
    exit
}

Write-Host "npm version: $(npm -v)"

# 4. Create .env if not exists
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file..."
@"
# Server Configuration
PORT=5001
NODE_ENV=development

# Database Configuration
MONGODB_URI="mongodb+srv://mayakalev2001:tripweb2025@cluster0.rtv7fot.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here_change_this_in_production
JWT_EXPIRE=7d

# Weather API Configuration
WEATHER_API_KEY=bbe10f214606fc1f3380403a39620a53

# CORS Configuration
CLIENT_URL=http://localhost:3000
"@ | Out-File -Encoding utf8 .env
    Write-Host ".env file created successfully"
} else {
    Write-Host ".env file already exists"
}

# 5. Install backend dependencies
if (Test-Path "server") {
    Write-Host "Installing backend dependencies..."
    Set-Location server
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install backend dependencies"
        exit
    }
    Set-Location ..
}

# 6. Install frontend dependencies (if exists)
if (Test-Path "client") {
    Write-Host "Installing frontend dependencies..."
    Set-Location client
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install frontend dependencies"
        exit
    }
    Set-Location ..
} else {
    Write-Host "No client folder found, skipping frontend install..."
}

Write-Host ""
Write-Host "Setup completed successfully!"
Write-Host "Next steps:"
Write-Host "1. Start backend: cd server && npm run dev"
Write-Host "2. Start frontend: cd client && npm start"
Write-Host "3. Open http://localhost:3000"
