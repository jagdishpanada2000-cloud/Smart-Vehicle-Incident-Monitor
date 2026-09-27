# Start SENTINEL Services (Database, Backend, Frontend)

Write-Host "1. Checking PostgreSQL database container..." -ForegroundColor Cyan
$pgRunning = docker ps --filter "name=sentinel-postgres" --filter "status=running" -q
if (-not $pgRunning) {
    Write-Host "Starting sentinel-postgres container..." -ForegroundColor Yellow
    docker start sentinel-postgres
} else {
    Write-Host "sentinel-postgres is already running." -ForegroundColor Green
}

Write-Host "`n2. Starting Spring Boot backend in a new window..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run backend"

Write-Host "`n3. Starting Vite React frontend..." -ForegroundColor Cyan
npm run dev
