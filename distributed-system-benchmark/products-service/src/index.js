import express from "express";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const PRODUCTS_DELAY_MS = parseInt(process.env.PRODUCTS_DELAY_MS || "0", 10);

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
    `[${new Date().toISOString()}] [products] [${operation}] latency=${latencyMs}ms`,
  );
};

const PRODUCTS = {
  1: { id: 1, name: "Notebook", price: 3000 },
  2: { id: 2, name: "Mouse", price: 150 },
  3: { id: 3, name: "Teclado", price: 300 },
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

app.get("/products/:id", async (req, res) => {
  const start = Date.now();
  metrics.requests++;

  try {
    await delay(PRODUCTS_DELAY_MS);

    const product = PRODUCTS[parseInt(req.params.id, 10)];
    const latencyMs = Date.now() - start;

    metrics.totalLatency += latencyMs;
    metrics.minLatency = Math.min(metrics.minLatency, latencyMs);
    metrics.maxLatency = Math.max(metrics.maxLatency, latencyMs);

    log("get_product", latencyMs);

    if (!product) {
      metrics.errors++;
      return res.status(404).json({ error: "product_not_found" });
    }

    res.json(product);
  } catch (err) {
    metrics.errors++;
    const latencyMs = Date.now() - start;
    log("get_product_error", latencyMs);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[products] listening on port ${PORT}`);
});
