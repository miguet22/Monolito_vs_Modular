// Lógica Frontend para Monolito Modular
const orderForm = document.getElementById("order-form");
const btnSubmit = document.getElementById("btn-submit");
const btnCrash = document.getElementById("btn-crash");
const ordersTbody = document.getElementById("orders-tbody");
const logTerminal = document.getElementById("log-terminal");
const metricLatency = document.getElementById("metric-latency");
const metricOrders = document.getElementById("metric-orders");
const metricHealth = document.getElementById("metric-health");
const ordersCountBadge = document.getElementById("orders-count-badge");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

let isServerAlive = true;
let failedPings = 0;

function appendLog(message, type = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  logTerminal.appendChild(entry);
  logTerminal.scrollTop = logTerminal.scrollHeight;
}

// Cargar pedidos y métricas iniciales
async function fetchOrders() {
  if (!isServerAlive) return;
  try {
    const res = await fetch("/api/orders");
    if (!res.ok) throw new Error("Error HTTP al obtener pedidos");
    const json = await res.json();
    renderOrders(json.data || []);
  } catch (err) {
    // Si no responde, la comprobación de salud lo detectará
  }
}

function renderOrders(orders) {
  metricOrders.textContent = orders.length;
  ordersCountBadge.textContent = `${orders.length} pedidos`;

  if (orders.length === 0) {
    ordersTbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          Aún no hay pedidos registrados. Crea uno arriba para ver la interacción.
        </td>
      </tr>
    `;
    return;
  }

  // Última latencia
  if (orders[0] && orders[0].notification && orders[0].notification.latencyMs !== undefined) {
    metricLatency.textContent = `${orders[0].notification.latencyMs} ms`;
  }

  ordersTbody.innerHTML = orders.map(order => {
    const notif = order.notification || {};
    const notifBadge = notif.status === "SENT" 
      ? `<span class="badge-success">✓ Enviada (${notif.communicationType || "In-Memory"})</span>`
      : `<span class="badge-danger">✗ Falló</span>`;

    const latencyDisplay = notif.latencyMs !== undefined ? `${notif.latencyMs} ms` : "N/A";
    const dateDisplay = new Date(order.createdAt).toLocaleTimeString();

    return `
      <tr>
        <td><strong>${order.id}</strong></td>
        <td>${order.customer}</td>
        <td>${order.item}</td>
        <td>$${order.amount}</td>
        <td><span class="badge-success">COMPLETADO</span></td>
        <td>${notifBadge}</td>
        <td><strong style="color: var(--accent-cyan);">${latencyDisplay}</strong></td>
        <td>${dateDisplay}</td>
      </tr>
    `;
  }).join("");
}

// Envío de formulario para crear orden
orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isServerAlive) {
    alert("No se pueden crear pedidos: El servidor está completamente caído.");
    return;
  }

  const customer = document.getElementById("customer").value.trim();
  const item = document.getElementById("item").value.trim();
  const amount = document.getElementById("amount").value;

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Procesando...";

  try {
    const startTime = performance.now();
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, item, amount })
    });

    const elapsed = (performance.now() - startTime).toFixed(1);

    if (!res.ok) {
      throw new Error(`Error en el servidor: ${res.statusText}`);
    }

    const data = await res.json();
    appendLog(`[PEDIDO CREADO] ${data.data.id} para ${customer} ($${amount}) en ${elapsed}ms`, "success");
    appendLog(`[NOTIFICACIÓN] Procesada en ${data.data.notification.latencyMs}ms.`, "info");
    
    await fetchOrders();
  } catch (err) {
    appendLog(`[ERROR AL CREAR PEDIDO] ${err.message}`, "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Procesar Pedido";
  }
});

// Chaos: Provocar caída del módulo de notificaciones
btnCrash.addEventListener("click", async () => {
  const confirmAction = confirm(
    "⚠️ ¿Deseas provocar una falla crítica en el Módulo de Notificaciones?\n\n" +
    "Al compartir el mismo proceso, la falla de este módulo detendrá el servidor completo."
  );

  if (!confirmAction) return;

  btnCrash.disabled = true;
  appendLog("[SIMULACIÓN] Inyectando excepción fatal en Módulo de Notificaciones...", "warn");

  try {
    await fetch("/api/chaos/crash-notification", { method: "POST" });
    appendLog("[SIMULACIÓN] El módulo arrojó un error no controlado.", "error");
    appendLog("[IMPACTO] El proceso del servidor está terminando...", "error");
  } catch (err) {
    appendLog("[IMPACTO] El servidor ha dejado de responder (Connection Refused).", "error");
  }
});

// Monitoreo de Salud (Heartbeat)
async function checkHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const res = await fetch("/api/health", { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      failedPings = 0;
      isServerAlive = true;
      statusDot.className = "status-dot";
      statusText.innerHTML = `Contenedor En Línea &bull; PID: <strong>${data.pid}</strong> &bull; Uptime: ${data.uptime}s`;
      metricHealth.textContent = "100%";
    } else {
      throw new Error("Respuesta no OK");
    }
  } catch (err) {
    failedPings++;
    if (failedPings >= 2 && isServerAlive) {
      isServerAlive = false;
      statusDot.className = "status-dot crashed";
      statusText.innerHTML = `<strong style="color: var(--accent-red)">💥 SERVIDOR CAÍDO (Proceso Finalizado)</strong>`;
      metricHealth.textContent = "0%";
      appendLog(`[ALERTA] El contenedor ya no responde peticiones HTTP.`, "error");
    }
  }
}

// Iniciar sondeo
fetchOrders();
setInterval(checkHealth, 1500);
