const express = require("express");
const cors = require("cors");
const path = require("path");

const ordersModule = require("./modules/orders");
const notificationsModule = require("./modules/notifications");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Endpoint de salud
app.get("/api/health", (req, res) => {
  res.json({
    status: "HEALTHY",
    architecture: "Monolito Modular",
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
    modules: {
      orders: ordersModule.getStatus(),
      notifications: notificationsModule.getStatus()
    }
  });
});

// Listar pedidos
app.get("/api/orders", (req, res) => {
  res.json({
    success: true,
    data: ordersModule.getOrders()
  });
});

// Crear pedido
app.post("/api/orders", async (req, res) => {
  try {
    const { customer, item, amount } = req.body;
    const order = await ordersModule.createOrder({ customer, item, amount });
    res.status(201).json({
      success: true,
      message: "Pedido creado y procesado en el monolito",
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Chaos Engineering: Provocar caída crítica en el módulo de notificaciones
app.post("/api/chaos/crash-notification", (req, res) => {
  const result = notificationsModule.triggerFatalCrash(
    "Fallo fatal en submódulo de notificaciones (Simulación de Bug de memoria / Crash no capturado)"
  );
  res.json(result);
});

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🏛️  MONOLITO MODULAR CORRIENDO EN PUERTO ${PORT}`);
  console.log(`📦 Módulos cargados en el mismo proceso (PID: ${process.pid}):`);
  console.log(`   - Módulo Orders [En memoria]`);
  console.log(`   - Módulo Notifications [En memoria]`);
  console.log(`🌐 Acceso web: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
