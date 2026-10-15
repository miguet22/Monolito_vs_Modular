# TP 2.1 DevOps: Monolito Modular vs Microservicios

## 📌 Datos de la Consigna
- **Categoría**: Arquitectura de Software
- **Tema**: Monolito modular y microservicios
- **Pregunta guía**: *¿Cuándo conviene separar un módulo como servicio y qué costo introduce?*
- **Demo práctica**: *Ejecutar dos módulos juntos y luego separar uno detrás de una API, provocar su caída para observar el impacto.*

---

## 1. Respuesta a la Pregunta Guía

### ¿Cuándo conviene separar un módulo como servicio?

La separación de un módulo de un monolito hacia un microservicio independiente no debe ser la opción por defecto, sino una **decisión justificada por necesidades técnicas u organizacionales concretas**. Conviene realizar esta extracción en los siguientes escenarios:

1. **Escalabilidad Asimétrica (Requerimientos de Cómputo Dispares):**
   - Cuando un módulo específico sufre una carga o demanda de recursos (CPU, memoria o I/O) mucho más alta o con patrones de picos diferentes al resto del sistema.
   - *Ejemplo:* Un módulo de transcodificación de video, procesamiento de imágenes o envío masivo de notificaciones/emails necesita decenas de réplicas, mientras que el módulo de pedidos o inventario requiere pocas instancias. En un monolito, escalar implica replicar toda la aplicación, desperdiciando recursos.

2. **Aislamiento de Fallas Crítico (Reducción del Blast Radius):**
   - Cuando la criticidad del negocio exige que el fallo de una función secundaria o inestable no comprometa la operación vital del negocio (Core Domain).
   - *Ejemplo:* Si el proveedor de envío de correos o notificaciones colapsa o sufre un bloqueo de memoria, una tienda online debe seguir cobrando y registrando pedidos (aplicando degradación elegante).

3. **Límites de Equipo y Despliegue Autónomo (Ley de Conway):**
   - Cuando la organización crece y múltiples equipos multidisciplinarios trabajan en el mismo repositorio monolítico, sufriendo cuellos de botella en integración, pipelines CI/CD largos y conflictos de merge constantes.
   - La separación permite ciclos de release y despliegues independientes con pipelines más rápidos y ownership claro.

4. **Heterogeneidad Tecnológica:**
   - Si un módulo requiere herramientas o lenguajes específicos que no encajan en el stack monolítico principal (por ejemplo, Python/PyTorch para un módulo de recomendaciones de Machine Learning, mientras el resto del sistema está en Node.js o Java).

---

### ¿Qué costo introduce separar un módulo como servicio?

La arquitectura de microservicios cambia las llamadas de función locales por llamadas de red, introduciendo las llamadas *"Falacias de la Computación Distribuida"*:

| Costo Introducido | Impacto en el Sistema | Evidencia Observada en la Demo |
| :--- | :--- | :--- |
| **1. Latencia de Red y Serialización** | Pasar de llamadas en memoria RAM (< 0.1 ms) a peticiones a través del stack de red TCP/IP y serialización/deserialización JSON (15 ms - 50 ms). | En la demo, la creación de orden en el Monolito toma **~5 ms**, mientras que a través del Microservicio toma **~35 ms - 45 ms**. |
| **2. Complejidad Operativa (DevOps)** | Deploys de múltiples contenedores, gestión de redes virtuales (Docker bridge), variables de entorno, DNS interno, orquestación y monitoreo de múltiples servicios. | En lugar de 1 solo contenedor y Dockerfile, se requieren 2 contenedores, Docker Compose y políticas de reinicio diferenciadas. |
| **3. Fallas Parciales y Resiliencia** | La red es inherentemente no confiable. Se vuelve obligatorio implementar timeouts, circuit breakers, reintentos idempotentes y manejo de degradación. | Se debió implementar un timeout de 2 segundos y lógica de Graceful Degradation en `order-service` para evitar que el usuario se quede bloqueado. |
| **4. Consistencia de Datos (Eventual)** | Pérdida de transacciones ACID locales. Si falla el servicio secundario, los datos quedan en estado asíncrono o pendiente de conciliación. | El pedido se guarda como `COMPLETED`, pero la notificación queda en estado `DEGRADED_FAILED` a la espera de un worker de reintento. |
| **5. Observabilidad y Debugging Distribuido** | Mayor dificultad para rastrear un error; se requieren IDs de correlación (Correlation IDs) y herramientas de tracing distribuido (OpenTelemetry / Jaeger). | La trazabilidad requiere inspeccionar logs de dos servicios independientes. |

---

## 2. Explicación de la Demo Práctica

La demo compara dos implementaciones del mismo caso de negocio: un módulo de **Pedidos (Orders)** que genera una venta y requiere notificar al cliente mediante un módulo de **Notificaciones (Notifications)**.

### Escenario 1: Monolito Modular (`http://localhost:3000`)
- **Topología:** Ambos módulos residen en el mismo proceso de Node.js dentro de un único contenedor Docker (`tp2-monolith-app`).
- **Interacción:** `ordersModule.createOrder()` invoca directamente `notificationsModule.sendNotification()` en memoria.
- **Experimento de Caída:** Se simula un crash fatal (excepción no capturada o corrupción de memoria) en el submódulo de notificaciones.
- **Impacto Observado:**
  - El proceso de Node.js colapsa por completo (`Process Exit`).
  - **Efecto dominó:** Aunque el módulo de pedidos no tenía ningún error de programación, **quedó totalmente inaccesible**. Ningún usuario puede navegar ni comprar.

### Escenario 2: Microservicio Separado (`http://localhost:4000`)
- **Topología:** El módulo de notificaciones fue extraído al contenedor `tp2-notification-service` (`:3001` / expuesto en `:4001`) con su propia API REST (`POST /api/notify`), comunicándose con `tp2-order-service` (`:4000`) mediante la red Docker Bridge.
- **Interacción:** El servicio de pedidos realiza una petición HTTP REST con timeout y captura de errores.
- **Experimento de Caída:** Se simula la caída del `notification-service` (HTTP 503 o parada de contenedor).
- **Impacto Observado:**
  - **Aislamiento de Fallas:** `tp2-order-service` **sigue 100% operativo**.
  - **Degradación Elegante:** El cliente recibe confirmación de su compra. La orden se registra en el sistema core y la notificación se marca para reintento posterior.
  - **Costo Visible:** La latencia promedio sube de ~5ms a ~40ms debido al salto de red.

---

## 3. Conclusión Arquitectónica
- **Monolito Modular:** Es la mejor opción para etapas tempranas (Startups, MVPs, equipos pequeños). Ofrece simplicidad operativa, transacciones atómicas y cero costo de red. Requiere mantener fronteras de código limpias para evitar código espagueti.
- **Microservicios:** Conviene adoptarlos cuando el costo de coordinación de equipos o la necesidad de escalabilidad y aislamiento de fallas supera con creces el costo de la complejidad distribuida.
