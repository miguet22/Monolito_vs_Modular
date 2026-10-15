@echo off
echo ====================================================
echo   Levantando Escenario 2: Microservicios Distribuidos
echo ====================================================
docker compose -f docker-compose.microservices.yml up --build
