/**
 * Módulo de Pedidos (Orders) en el Monolito Modular
 * Gestiona el ciclo de vida de los pedidos y llama al módulo de notificaciones en memoria.
 */
const notificationsModule = require("./notifications");

// Almacén en memoria de órdenes
const ordersDatabase = [];
let nextOrderId = 1001;

const ordersModule = {
  name: "orders-module",
  type: "in-memory-module",

  /**
   * Obtiene la lista histórica de pedidos
   */
  getOrders() {
    return [...ordersDatabase].reverse();
  },

  /**
   * Crea un pedido nuevo y llama al módulo de notificaciones
   */
  async createOrder({ customer, item, amount }) {
    if (!customer || !item || !amount) {
      throw new Error("Datos de pedido incompletos (cliente, producto y monto requeridos).");
    }

    const orderId = `ORD-${nextOrderId++}`;
    const createdAt = new Date().toISOString();

    const orderRecord = {
      id: orderId,
      customer,
      item,
      amount: Number(amount),
      createdAt,
      status: "COMPLETED",
      architecture: "Monolito Modular",
      notification: null
    };

    const callStartTime = process.hrtime.bigint();

    try {
      // LLAMADA EN MEMORIA DIRECTA (Sin red, sin serialización HTTP)
      const notificationResult = await notificationsModule.sendNotification(orderRecord);
      
      const callEndTime = process.hrtime.bigint();
      const totalTimeMs = Number(callEndTime - callStartTime) / 1_000_000;

      orderRecord.notification = {
        ...notificationResult,
        totalExecutionTimeMs: parseFloat(totalTimeMs.toFixed(2))
      };
    } catch (err) {
      // Si el módulo falla (no fatal)
      orderRecord.status = "PARTIAL_FAILURE";
      orderRecord.notification = {
        status: "FAILED",
        error: err.message
      };
    }

    ordersDatabase.push(orderRecord);
    return orderRecord;
  },

  getStatus() {
    return {
      module: "orders",
      totalOrders: ordersDatabase.length,
      status: "HEALTHY",
      processId: process.pid,
      uptimeSeconds: Math.floor(process.uptime())
    };
  }
};

module.exports = ordersModule;
