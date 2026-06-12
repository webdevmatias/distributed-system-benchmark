import express from "express";
import fetch from "node-fetch";
import amqplib from "amqplib";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const PRODUCTS_SERVICE_URL =
  process.env.PRODUCTS_SERVICE_URL || "http://localhost:3002";
const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const ORDERS_DELAY_MS = parseInt(process.env.ORDERS_DELAY_MS || "0", 10);
const QUEUE = "orders.created";

const metrics = {
  requests: 0,
  totalLatency: 0,
  minLatency: Infinity,
  maxLatency: 0,
  errors: 0,
};

let channel = null;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const log = (operation, latencyMs) => {
  console.log(
    `[${new Date().toISOString()}] [orders] [${operation}] latency=${latencyMs}ms`,
  );
};

async function connectRabbitMQ() {
  const RETRY_DELAY = 3000;
  while (true) {
    try {
      const conn = await amqplib.connect(RABBITMQ_URL);
      channel = await conn.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });
      console.log("[orders] connected to RabbitMQ");
      conn.on("close", () => {
        console.warn("[orders] RabbitMQ connection closed, retrying...");
        channel = null;
        setTimeout(connectRabbitMQ, RETRY_DELAY);
      });
      break;
    } catch (err) {
      console.warn(
        `[orders] RabbitMQ not ready, retrying in ${RETRY_DELAY}ms...`,
      );
      await delay(RETRY_DELAY);
    }
  }
}

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

app.post("/orders", async (req, res) => {
  const start = Date.now();
  metrics.requests++;

  try {
    const productId = req.body.productId || 1;

    const productRes = await fetch(
      `${PRODUCTS_SERVICE_URL}/products/${productId}`,
    );
    if (!productRes.ok) {
      metrics.errors++;
      return res.status(404).json({ error: "product_not_found" });
    }
    const product = await productRes.json();

    await delay(ORDERS_DELAY_MS);

    const orderId = uuidv4();
    const message = {
      orderId,
      productId: product.id,
      createdAt: Date.now(),
    };

    if (!channel) {
      metrics.errors++;
      return res.status(503).json({ error: "queue_unavailable" });
    }

    channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(message)), {
      persistent: true,
    });

    const latencyMs = Date.now() - start;
    metrics.totalLatency += latencyMs;
    metrics.minLatency = Math.min(metrics.minLatency, latencyMs);
    metrics.maxLatency = Math.max(metrics.maxLatency, latencyMs);

    log("create_order", latencyMs);

    res.status(201).json({ orderId, productId: product.id, status: "queued" });
  } catch (err) {
    metrics.errors++;
    const latencyMs = Date.now() - start;
    log("create_order_error", latencyMs);
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

await connectRabbitMQ();

app.listen(PORT, () => {
  console.log(`[orders] listening on port ${PORT}`);
});
