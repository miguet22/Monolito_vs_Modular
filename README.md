# 🚀 TP 2.1 DevOps - Monolito Modular y Microservicios

Este repositorio contiene la solución completa y práctica para la consigna del **TP 2.1 de DevOps (Tema 1: Arquitectura)**.

---

## 🎯 Consigna del Trabajo Práctico

| TEMA | Categoría | Tema | Pregunta guía | Demo práctica sugerida |
| :---: | :---: | :---: | :---: | :---: |
| **1** | **Arquitectura** | **Monolito modular y microservicios** | *¿Cuándo conviene separar un módulo como servicio y qué costo introduce?* | *Ejecutar dos módulos juntos y luego separar uno detrás de una API, provocar su caída para observar el impacto.* |

---

## 📂 Estructura del Proyecto

```text
Tp2.1_devops/
├── monolith/                         # Escenario 1: Monolito Modular
│   ├── src/
│   │   ├── modules/
│   │   │   ├── orders.js             # Módulo de Pedidos (en memoria)
│   │   │   └── notifications.js      # Módulo de Notificaciones (en memoria)
│   │   ├── public/                   # Dashboard Web Interactivo Monolito
│   │   └── server.js                 # Servidor Express unificado
│   ├── Dockerfile
│   └── package.json
│
├── microservices/                    # Escenario 2: Microservicios Distribuidos
│   ├── order-service/                # Servicio Core (Pedidos + Dashboard Web)
│   │   ├── src/
│   │   │   ├── public/               # Dashboard Web Interactivo Microservicios
│   │   │   └── server.js             # Lógica de pedidos + cliente HTTP + Graceful Degradation
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── notification-service/         # Módulo extraído detrás de una API REST
│       ├── src/
│       │   └── server.js             # API REST (/api/notify) + Endpoints de Chaos
│       ├── Dockerfile
│       └── package.json
│
├── docker-compose.monolith.yml       # Compose para levantar solo el Monolito (:3000)
├── docker-compose.microservices.yml  # Compose para levantar solo Microservicios (:4000 y :4001)
├── docker-compose.yml                # Compose unificado para comparar ambos simultáneamente
├── run-monolith.bat                  # Script Windows para Monolito
├── run-microservices.bat             # Script Windows para Microservicios
├── run-all.bat                       # Script Windows para levantar ambos
├── stop-all.bat                      # Script Windows para detener contenedores
├── teoria/
│   ├── ARQUITECTURA.md               # Análisis de arquitectura y justificaciones
│   └── INFORME_TEORICO.md            # Respuestas teóricas completas a la pregunta guía
└── README.md                         # Guía de uso y paso a paso
```

---

## ⚡ Cómo Ejecutar en Local con Docker

Se puede ejecutar el proyecto de forma individual o ambos escenarios en paralelo (tienen puertos asignados diferentes para no colisionar):

### Opción A: Comparación Simultánea (Recomendada)
Para abrir ambos en pestañas contiguas del navegador y comparar en tiempo real:

```bash
docker compose up --build
```
*(O ejecutar el script `run-all.bat` en Windows)*

- **Monolito Modular:** [http://localhost:3000](http://localhost:3000)
- **Microservicios:** [http://localhost:4000](http://localhost:4000)

---

### Opción B: Ejecutar solo el Monolito Modular (Fase 1)

```bash
docker compose -f docker-compose.monolith.yml up --build
```
*(O ejecutar `run-monolith.bat`)*

Abrir en tu navegador: [http://localhost:3000](http://localhost:3000)

---

### Opción C: Ejecutar solo los Microservicios (Fase 2)

```bash
docker compose -f docker-compose.microservices.yml up --build
```
*(O ejecutar `run-microservices.bat`)*

Abrir en tu navegador: [http://localhost:4000](http://localhost:4000)

---

## 🧪 Paso a Paso para la Demo Práctica

### 1. Demostración en el Monolito Modular (`http://localhost:3000`)
1. **Crear pedidos normales:** Llenar el formulario y hacer clic en *"Procesar Pedido en Monolito"*.
   - **Observar la métrica de latencia:** es de **~0 ms a 5 ms** (la llamada entre módulos ocurre en la misma memoria RAM, sin red ni serialización).
2. **Provocar la caída (Chaos Experiment):**
   - Hacer clic en el botón rojo: **"💥 Provocar Caída del Módulo de Notificaciones"**.
3. **Observar el impacto:**
   - Una excepción fatal no capturada dentro del submódulo de notificaciones tira abajo **todo el proceso Node.js**.
   - El contenedor pasa a estado **CAÍDO / Connection Refused**.
   - **Conclusión observada:** No existe aislamiento de fallas; la caída de un componente secundario (notificaciones) destruyó la disponibilidad del servicio crítico (pedidos).

---

### 2. Demostración en Microservicios (`http://localhost:4000`)
1. **Crear pedidos normales:** Llenar el formulario y hacer clic en *"Ejecutar Pedido a través de la Red"*.
   - **Observar el costo de red:** La latencia sube a **~35 ms - 45 ms** (costo introducido por el viaje por red Docker Bridge, stack TCP/IP y serialización JSON).
2. **Provocar la caída del microservicio separado:**
   - Hacer clic en el botón: **"💥 Simular Caída (HTTP 503)"** (o correr en consola `docker stop tp2-notification-service`).
   - El panel muestra que `Notification-Service` está **CAÍDO**, pero `Order-Service` permanece **ONLINE**.
3. **Probar crear un nuevo pedido con el servicio caído:**
   - Completar el formulario y enviar un nuevo pedido.
   - **Observar el impacto:**
     - ¡El pedido **SE COMPLETA CON ÉXITO** (`COMPLETED - DEGRADADO`)!
     - El negocio no pierde la venta. Se activa el patrón de **Degradación Elegante (Graceful Degradation)**: el sistema captura el error de red / timeout y programa la notificación para reintento posterior.
4. **Restaurar el servicio:**
   - Hacer clic en **"✨ Restaurar Servicio"** (o `docker start tp2-notification-service`).
   - El sistema vuelve a operar en estado 100% saludable.

---


### Resumen

1. **¿Cuándo conviene separar un módulo como servicio?**
   - **Escalabilidad asimétrica:** El módulo consume recursos desproporcionados (CPU/RAM) respecto al resto.
   - **Aislamiento de fallas crítico (Blast Radius):** Evitar que fallos en funciones secundarias derriben el core del negocio.
   - **Autonomía de equipos (Ley de Conway):** Equipos independientes que necesitan desplegar sin coordinar deploys monolíticos.
   - **Heterogeneidad tecnológica:** Necesidad de lenguajes o librerías específicas (ej. Python para IA, Go para networking).

2. **¿Qué costo introduce?**
   - **Latencia de red y serialización:** De llamadas en RAM (<0.1ms) a llamadas HTTP/gRPC (15-50ms).
   - **Complejidad operativa (DevOps):** Redes Docker, orquestación, CI/CD independiente, DNS interno.
   - **Manejo de fallas parciales:** Necesidad de implementar timeouts, retries, circuit breakers y degradación elegante.
   - **Consistencia eventual:** Pérdida de transacciones ACID locales; gestión de estados asíncronos.
   - **Observabilidad distribuida:** Trazabilidad de logs cruzados y telemetría compleja.
