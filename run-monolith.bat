@echo off
echo ====================================================
echo   Levantando Escenario 1: Monolito Modular
echo ====================================================
docker compose -f docker-compose.monolith.yml up --build
