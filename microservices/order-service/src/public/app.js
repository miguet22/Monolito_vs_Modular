// Frontend Logic para Microservicios Distribuidos
const orderForm = document.getElementById("order-form");
const btnSubmit = document.getElementById("btn-submit");
const btnToggleDown = document.getElementById("btn-toggle-down");
const btnRestore = document.getElementById("btn-restore");
const ordersTbody = document.getElementById("orders-tbody");
const logTerminal = document.getElementById("log-terminal");
const metricLatency = document.getElementById("metric-latency");
const metricOrders = document.getElementById("metric-orders");
const metricDegraded = document.getElementById("metric-degraded");
const ordersCountBadge = document.getElementById("orders-count-badge");

// Elementos de estado
const orderStatusDot = document.getElementById("order-status-dot");
const orderStatusText = document.getElementById("order-status-text");
const notifStatusDot = document.getElementById("notif-status-dot");
const notifStatusText = document.getElementById("notif-status-text");

let isNotifServiceOnline = true;

function appendLog(message, type = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  logTerminal.appendChild(entry);
  logTerminal.scrollTop = logTerminal.scrollHeight;
}

// Obtener pedidos
async function fetchOrders() {
  try {
    const res = await fetch("/api/orders");
    if (!res.ok) throw new Error("Error HTTP al obtener pedidos");
    const json = await res.json();
    renderOrders(json.data || []);
  } catch (err) {
    appendLog(`[ERROR] No se pudo consultar la lista de pedidos: ${err.message}`, "error");
  }
}

function renderOrders(orders) {
  const completedCount = orders.filter(o => o.status === "COMPLETED").length;
  metricOrders.textContent = completedCount;
  ordersCountBadge.textContent = `${orders.length} pedidos`;

  const degradedCount = orders.filter(o => o.notification && o.notification.status === "DEGRADED_FAILED").length;
  metricDegraded.textContent = degradedCount;

  if (orders.length === 0) {
    ordersTbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
          Aún no hay pedidos registrados. Crea uno arriba para comenzar.
        </td>
      </tr>
    `;
    return;
  }

  // Última latencia registrada
  if (orders[0] && orders[0].notification && orders[0].notification.latencyMs !== undefined) {
    metricLatency.textContent = `${orders[0].notification.latencyMs} ms`;
  }

  ordersTbody.innerHTML = orders.map(order => {
    const notif = order.notification || {};
    const isSuccess = notif.status === "SENT";
    
    const notifBadgeHtml = isSuccess
      ? `<span class="badge-success">✓ Entregada (HTTP 200)</span>`
      : `<span class="badge-danger">✗ No enviada (Servicio Caído)</span>`;

    const statusBadgeHtml = isSuccess
      ? `<span class="badge-success">COMPLETADO</span>`
      : `<span class="badge-warning">PENDIENTE (DEGRADADO)</span>`;

    const latencyDisplay = notif.latencyMs !== undefined ? `${notif.latencyMs} ms` : "N/A";
    const detailMsg = isSuccess
      ? `<span style="color: var(--text-muted);">Notificación ID: ${notif.notificationId || 'N/A'}</span>`
      : `<span style="color: var(--accent-amber);">⚠️ Pendiente de completar &bull; Reintentos: ${notif.retryAttempts || 0} &bull; Próximo intento automático</span>`;

    return `
      <tr>
        <td><strong>${order.id}</strong></td>
        <td>${order.customer}</td>
        <td>${order.item}</td>
        <td>$${order.amount}</td>
        <td>${statusBadgeHtml}</td>
        <td>${notifBadgeHtml}</td>
        <td><strong style="color: #c084fc;">${latencyDisplay}</strong></td>
        <td>${detailMsg}</td>
      </tr>
    `;
  }).join("");
}

// Envío de formulario para crear orden
orderForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const customer = document.getElementById("customer").value.trim();
  const item = document.getElementById("item").value.trim();
  const amount = document.getElementById("amount").value;

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Transmitiendo...";

  try {
    const startTime = performance.now();
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer, item, amount })
    });

    const elapsed = (performance.now() - startTime).toFixed(1);
    const json = await res.json();

    if (json.degraded) {
      appendLog(`[PEDIDO ACEPTADO CON DEGRADACIÓN] ${json.data.id} creado en ${elapsed}ms`, "warn");
      appendLog(`[RESILIENCIA] Notification Service falló (${json.data.notification.error}); ${json.data.id} queda pendiente de completar.`, "warn");
    } else {
      appendLog(`[PEDIDO CREADO] ${json.data.id} completado. Latencia de red HTTP: ${json.data.notification.latencyMs}ms.`, "success");
    }

    await fetchOrders();
  } catch (err) {
    appendLog(`[ERROR INESPERADO] ${err.message}`, "error");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Ejecutar Pedido";
  }
});

// Chaos: Provocar caída del servicio de notificaciones
btnToggleDown.addEventListener("click", async () => {
  appendLog("[SIMULACIÓN] Enviando señal de caída al Notification-Service...", "warn");
  try {
    const res = await fetch("/api/chaos/toggle-downtime", { method: "POST" });
    const data = await res.json();
    appendLog(`[SIMULACIÓN] ${data.message}`, "error");
    await checkHealth();
  } catch (err) {
    appendLog(`[SIMULACIÓN ERROR] No se pudo enviar señal: ${err.message}`, "error");
  }
});

// Chaos: Restaurar servicio
btnRestore.addEventListener("click", async () => {
  appendLog("[SIMULACIÓN] Restaurando Notification-Service a estado operativo...", "info");
  try {
    const res = await fetch("/api/chaos/restore", { method: "POST" });
    const data = await res.json();
    appendLog(`[SIMULACIÓN] ${data.message}`, "success");
    await checkHealth();
  } catch (err) {
    appendLog(`[SIMULACIÓN ERROR] No se pudo restaurar: ${err.message}`, "error");
  }
});

// Monitoreo de Salud Continuo
async function checkHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch("/api/health", { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      
      // Order service siempre en línea aquí
      orderStatusDot.className = "status-dot pulsing";
      orderStatusText.innerHTML = `Order-Service: <strong>ONLINE</strong> (PID: ${data.pid})`;

      // Estado de Notification Service remoto
      const remote = data.remoteServices.notificationService;
      if (remote.status === "HEALTHY") {
        isNotifServiceOnline = true;
        notifStatusDot.className = "status-dot pulsing";
        notifStatusText.innerHTML = `Notification-Service: <strong>ONLINE</strong> (${remote.latencyMs || 0}ms)`;
      } else {
        isNotifServiceOnline = false;
        notifStatusDot.className = "status-dot crashed";
        notifStatusText.innerHTML = `Notification-Service: <strong style="color: var(--accent-red);">CAÍDO (${remote.status})</strong>`;
      }
    }
  } catch (err) {
    orderStatusDot.className = "status-dot crashed";
    orderStatusText.innerHTML = `Order-Service: <strong style="color: var(--accent-red);">DESCONECTADO</strong>`;
  }
}

// Iniciar sondeo
fetchOrders();
setInterval(checkHealth, 2000);
setInterval(fetchOrders, 2000);
