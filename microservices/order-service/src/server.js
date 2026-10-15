const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3001";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Almacén de pedidos en memoria
const ordersDatabase = [];
let nextOrderId = 5001;

// Endpoint de salud que verifica este microservicio y sondea el servicio de notificaciones
app.get("/api/health", async (req, res) => {
  let notifStatus = "UNKNOWN";
  let notifError = null;
  let notifLatencyMs = null;

  try {
    const start = process.hrtime.bigint();
    const probe = await fetch(`${NOTIFICATION_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(1500)
    });
    const end = process.hrtime.bigint();
    notifLatencyMs = parseFloat((Number(end - start) / 1_000_000).toFixed(2));

    if (probe.ok) {
      notifStatus = "HEALTHY";
    } else {
      notifStatus = "UNHEALTHY (HTTP " + probe.status + ")";
    }
  } catch (err) {
    notifStatus = "DOWN / UNREACHABLE";
    notifError = err.cause?.code || err.name || err.message;
  }

  res.json({
    status: "HEALTHY",
    service: "order-service",
    architecture: "Microservicios Distribuidos",
    port: PORT,
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
    remoteServices: {
      notificationService: {
        url: NOTIFICATION_SERVICE_URL,
        status: notifStatus,
        latencyMs: notifLatencyMs,
        error: notifError
      }
    }
  });
});

// Listar pedidos
app.get("/api/orders", (req, res) => {
  res.json({
    success: true,
    data: [...ordersDatabase].reverse()
  });
});

// Crear nuevo pedido llamando al microservicio de notificaciones por HTTP
app.post("/api/orders", async (req, res) => {
  const { customer, item, amount } = req.body;

  if (!customer || !item || !amount) {
    return res.status(400).json({
      success: false,
      error: "Datos incompletos (cliente, producto y monto requeridos)."
    });
  }

  const orderId = `ORD-MS-${nextOrderId++}`;
  const createdAt = new Date().toISOString();

  const newOrder = {
    id: orderId,
    customer,
    item,
    amount: Number(amount),
    createdAt,
    status: "COMPLETED", // El pedido se concreta exitosamente
    architecture: "Microservicios (HTTP REST)",
    notification: null
  };

  const callStartTime = process.hrtime.bigint();
  let networkTimeMs = 0;

  try {
    console.log(`[ORDER-SERVICE] Llamando a microservicio de notificaciones (${NOTIFICATION_SERVICE_URL}/api/notify)...`);

    // LLAMADA HTTP A TRAVÉS DE LA RED DOCKER (Introduce costo de red y serialización JSON)
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        customer,
        item,
        amount
      }),
      signal: AbortSignal.timeout(2000) // Timeout de 2 segundos para no colgar el servicio
    });

    const callEndTime = process.hrtime.bigint();
    networkTimeMs = parseFloat((Number(callEndTime - callStartTime) / 1_000_000).toFixed(2));

    if (!response.ok) {
      throw new Error(`Servicio de notificaciones respondió con HTTP ${response.status}`);
    }

    const notifData = await response.json();

    newOrder.notification = {
      status: "SENT",
      channel: "HTTP REST API / Docker Network",
      latencyMs: networkTimeMs,
      notificationId: notifData.notificationId,
      deliveredAt: notifData.deliveredAt
    };

    console.log(`[ORDER-SERVICE] Notificación completada exitosamente en ${networkTimeMs}ms.`);

    ordersDatabase.push(newOrder);

    return res.status(201).json({
      success: true,
      message: "Pedido creado y notificación enviada por microservicio.",
      data: newOrder,
      degraded: false
    });
  } catch (err) {
    const callEndTime = process.hrtime.bigint();
    networkTimeMs = parseFloat((Number(callEndTime - callStartTime) / 1_000_000).toFixed(2));

    console.warn(`[ORDER-SERVICE] [FALLA AISLADA] No se pudo notificar: ${err.message}.`);
    console.warn(`[ORDER-SERVICE] [DEGRADACIÓN ELEGANTE] El pedido ${orderId} fue guardado igualmente.`);

    // PATRÓN DE RESILIENCIA: DEGRADACIÓN ELEGANTE (Graceful Degradation)
    // El pedido NO se cancela porque el servicio no crítico (notificaciones) esté caído.
    newOrder.notification = {
      status: "DEGRADED_FAILED",
      channel: "HTTP REST API (Caído)",
      latencyMs: networkTimeMs,
      error: err.cause?.code || err.message,
      explanation: "El pedido se guardó con éxito. La notificación se encolará para reintento posterior."
    };

    ordersDatabase.push(newOrder);

    return res.status(201).json({
      success: true,
      message: "Pedido creado exitosamente, pero el servicio de notificaciones está caído. Aislamiento de fallas en acción.",
      data: newOrder,
      degraded: true
    });
  }
});

// Chaos Proxy: Alternar caída simulada en el microservicio de notificaciones
app.post("/api/chaos/toggle-downtime", async (req, res) => {
  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/chaos/toggle-downtime`, {
      method: "POST",
      signal: AbortSignal.timeout(2000)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `No se pudo comunicar con el servicio de notificaciones: ${err.message}`
    });
  }
});

// Chaos Proxy: Restaurar
app.post("/api/chaos/restore", async (req, res) => {
  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/chaos/restore`, {
      method: "POST",
      signal: AbortSignal.timeout(2000)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `No se pudo comunicar con el servicio de notificaciones: ${err.message}`
    });
  }
});

// Chaos Proxy: Crash del proceso en el servicio de notificaciones
app.post("/api/chaos/crash", async (req, res) => {
  try {
    const response = await fetch(`${NOTIFICATION_SERVICE_URL}/api/chaos/crash`, {
      method: "POST",
      signal: AbortSignal.timeout(2000)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({
      success: false,
      error: `Error al intentar crashear: ${err.message}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 MICROSERVICIO DE PEDIDOS (ORDER SERVICE) ACTIVO`);
  console.log(`📡 Puerto: ${PORT} | PID: ${process.pid}`);
  console.log(`🔗 Destino Notification Service: ${NOTIFICATION_SERVICE_URL}`);
  console.log(`🌐 Acceso web: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
