@echo off
title Quantum Map System Starter

echo Starting Node Server...
start cmd /k "cd server && nodemon index.js"

echo Starting Python Simulation...
start cmd /k "cd simulation && python bot_logic.py"

echo Starting React Frontend...
start cmd /k "cd client && npm run dev"

echo All services started!
pause