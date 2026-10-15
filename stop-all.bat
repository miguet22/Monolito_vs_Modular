@echo off
echo Deteniendo todos los contenedores...
docker compose down
docker compose -f docker-compose.monolith.yml down
docker compose -f docker-compose.microservices.yml down
echo Listo. Contenedores detenidos.
