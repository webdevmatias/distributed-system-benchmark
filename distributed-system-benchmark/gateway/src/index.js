import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ORDERS_SERVICE_URL =
  process.env.ORDERS_SERVICE_URL || "http://localhost:3001";
const GATEWAY_DELAY_MS = parseInt(process.env.GATEWAY_DELAY_MS || "0", 10);

const metrics = {
  requests: 0,
  totalLatency: 0,
  minLatency: Infinity,
  maxLatency: 0,
  errors: 0,
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const log = (operation, latencyMs) => {
  console.log(
    `[${new Date().toISOString()}] [gateway] [${operation}] latency=${latencyMs}ms`,
  );
};

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/metrics", (_req, res) => {
  const avg =
    metrics.requests > 0 ? metrics.totalLatency / metrics.requests : 0;
  res.json({
    requests: metrics.requests,
    avgLatency: parseFloat(avg.toFixed(2)),
    minLatency: metrics.minLatency === Infinity ? 0 : metrics.minLatency,
    maxLatency: metrics.maxLatency,
    errors: metrics.errors,
  });
});

app.post("/api/orders", async (req, res) => {
  const start = Date.now();
  metrics.requests++;

  try {
    await delay(GATEWAY_DELAY_MS);

    const response = await fetch(`${ORDERS_SERVICE_URL}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    const latencyMs = Date.now() - start;

    metrics.totalLatency += latencyMs;
    metrics.minLatency = Math.min(metrics.minLatency, latencyMs);
    metrics.maxLatency = Math.max(metrics.maxLatency, latencyMs);

    log("forward_order", latencyMs);
    res.status(response.status).json(data);
  } catch (err) {
    metrics.errors++;
    const latencyMs = Date.now() - start;
    log("forward_order_error", latencyMs);
    res.status(502).json({ error: "gateway_error", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[gateway] listening on port ${PORT}`);
});
