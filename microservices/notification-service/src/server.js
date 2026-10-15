const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Estado del microservicio
let isSimulatingDown = false;
let notificationCount = 0;

// Healthcheck
app.get("/health", (req, res) => {
  if (isSimulatingDown) {
    return res.status(503).json({
      status: "DOWN",
      service: "notification-service",
      message: "Servicio caído intencionalmente para pruebas de resiliencia (Chaos Engineering)."
    });
  }

  res.json({
    status: "HEALTHY",
    service: "notification-service",
    port: PORT,
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
    notificationsProcessed: notificationCount
  });
});

// Endpoint principal detrás de la API REST
app.post("/api/notify", async (req, res) => {
  if (isSimulatingDown) {
    console.warn(`[NOTIF-SERVICE] Rechazando notificación para orden ${req.body.orderId || 'desc'} - Servicio Caído (503).`);
    return res.status(503).json({
      success: false,
      error: "Notification Service Unavailable (Simulated Outage)"
    });
  }

  const { orderId, customer, item, amount } = req.body;

  // Simular latencia de procesamiento y comunicación externa (ej. envío a SendGrid/Twilio): 35ms
  await new Promise((resolve) => setTimeout(resolve, 35));

  notificationCount++;
  console.log(`[NOTIF-SERVICE] Notificación enviada para orden ${orderId} (${customer} - $${amount})`);

  res.status(200).json({
    success: true,
    notificationId: `NOTIF-${Date.now()}`,
    orderId,
    recipient: customer,
    channel: "HTTP REST API / External Gateway",
    deliveredAt: new Date().toISOString(),
    serviceUptime: Math.floor(process.uptime())
  });
});

// Chaos: Alternar modo caído (503)
app.post("/api/chaos/toggle-downtime", (req, res) => {
  isSimulatingDown = !isSimulatingDown;
  console.log(`[NOTIF-SERVICE] Modo de falla cambiado: isSimulatingDown = ${isSimulatingDown}`);
  res.json({
    success: true,
    isSimulatingDown,
    message: isSimulatingDown
      ? "Servicio de notificaciones marcado como CAÍDO (devolverá 503 Service Unavailable)."
      : "Servicio de notificaciones RESTAURADO (operando normalmente)."
  });
});

// Chaos: Restaurar
app.post("/api/chaos/restore", (req, res) => {
  isSimulatingDown = false;
  console.log(`[NOTIF-SERVICE] Servicio restaurado.`);
  res.json({
    success: true,
    isSimulatingDown: false,
    message: "Servicio de notificaciones RESTAURADO."
  });
});

// Chaos: Provocar salida fatal del proceso Node.js (detiene el contenedor)
app.post("/api/chaos/crash", (req, res) => {
  console.error(`[NOTIF-SERVICE] Recibida orden de CRASH FATAL. Finalizando proceso...`);
  res.json({
    success: true,
    message: "Proceso terminando en 500ms. El contenedor de notificaciones se detendrá."
  });

  setTimeout(() => {
    process.exit(1);
  }, 500);
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🔔 MICROSERVICIO DE NOTIFICACIONES ACTIVO`);
  console.log(`📡 Puerto: ${PORT} | PID: ${process.pid}`);
  console.log(`🔗 Endpoint API: POST http://localhost:${PORT}/api/notify`);
  console.log(`❤️  Healthcheck: GET http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});
