Write-Host "Starting Aequitas-Gov Setup..." -ForegroundColor Green

Write-Host "Installing Backend Dependencies..." -ForegroundColor Cyan
pip install -r requirements.txt

Write-Host "Starting FastAPI Backend (Port 8000) in a new window..." -ForegroundColor Blue
Start-Process -FilePath "python" -ArgumentList "-m uvicorn api:app --reload --port 8000"

Write-Host "Installing Frontend Dependencies..." -ForegroundColor Cyan
cd frontend
npm install

Write-Host "Starting React Frontend (Port 5173)..." -ForegroundColor Magenta
npm run dev -- --port 5173
