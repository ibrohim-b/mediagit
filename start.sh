#!/bin/bash

cd "$(dirname "$0")"

# Backend
cd backend
python3 -m venv .venv 2>/dev/null
source .venv/bin/activate
pip3 install -r requirements.txt -q
python3 main.py &
BACKEND_PID=$!
cd ..

# Frontend
cd frontend
npm install -q
npm run dev -- --host &
FRONTEND_PID=$!
cd ..

echo "Backend PID: $BACKEND_PID | Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both"

trap "kill $BACKEND_PID $FRONTEND_PID" INT
wait
