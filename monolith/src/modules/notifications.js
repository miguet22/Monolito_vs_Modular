/**
 * Módulo de Notificaciones (Parte del Monolito Modular)
 * Se ejecuta dentro del mismo proceso y memoria que el resto de la aplicación.
 */

let isHealthy = true;

const notificationsModule = {
  name: "notifications-module",
  type: "in-memory-module",

  /**
   * Envía una notificación para una orden creada.
   * Al ser monolito, es una llamada directa a método en memoria (in-process).
   */
  async sendNotification(order) {
    if (!isHealthy) {
      throw new Error("El módulo de notificaciones ha fallado internamente.");
    }

    const startTime = process.hrtime.bigint();

    // Simula procesamiento interno mínimo (5ms)
    await new Promise((resolve) => setTimeout(resolve, 5));

    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;

    return {
      status: "SENT",
      channel: "Email & SMS (Simulado)",
      recipient: order.customer,
      message: `Confirmación de compra: ${order.item} ($${order.amount})`,
      latencyMs: parseFloat(durationMs.toFixed(2)),
      communicationType: "In-Memory Function Call (0ms network)"
    };
  },

  /**
   * Simula un fallo crítico no recuperable dentro del módulo.
   * En una arquitectura monolítica, una excepción fatal no capturada
   * o un desbordamiento en cualquier módulo derriba TODO el proceso del servidor.
   */
  triggerFatalCrash(reason = "Error de memoria irrecuperable en worker de notificaciones") {
    console.error(`\n[CRITICAL FAILURE] Módulo de notificaciones sufrió un crash: ${reason}`);
    console.error("[CRITICAL FAILURE] Al estar en un monolito, el proceso entero Node.js colapsará...\n");

    // Despachar el crash de forma asíncrona inmediata para permitir responder la petición antes de morir
    setTimeout(() => {
      // Simula excepción no capturada que tira abajo el proceso completo
      throw new Error(`[FATAL CRASH EN MONOLITO] ${reason}. El proceso principal ha muerto.`);
    }, 500);

    return {
      success: false,
      message: "Fallo fatal provocado. El proceso del servidor monolítico se apagará en 500ms."
    };
  },

  getStatus() {
    return {
      module: "notifications",
      status: isHealthy ? "HEALTHY" : "CRASHED",
      architecture: "Monolito Modular (In-Memory)",
      processId: process.pid,
      uptimeSeconds: Math.floor(process.uptime())
    };
  }
};

module.exports = notificationsModule;
