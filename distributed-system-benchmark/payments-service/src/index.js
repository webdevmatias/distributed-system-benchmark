import express from "express";
import amqplib from "amqplib";
import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname } from "path";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;
const RABBITMQ_URL =
  process.env.RABBITMQ_URL || "amqp://guest:guest@localhost:5672";
const SQLITE_PATH = process.env.SQLITE_PATH || "./data/database.sqlite";
const PAYMENTS_DELAY_MS = parseInt(process.env.PAYMENTS_DELAY_MS || "0", 10);
const QUEUE = "orders.created";

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
    `[${new Date().toISOString()}] [payments] [${operation}] latency=${latencyMs}ms`,
  );
};

mkdirSync(dirname(SQLITE_PATH), { recursive: true });
const db = new Database(SQLITE_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL,
    queue_time_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

const insertPayment = db.prepare(
  "INSERT INTO payments (order_id, status, queue_time_ms, created_at) VALUES (?, ?, ?, ?)",
);

async function connectRabbitMQ() {
  const RETRY_DELAY = 3000;
  while (true) {
    try {
      const conn = await amqplib.connect(RABBITMQ_URL);
      const channel = await conn.createChannel();
      await channel.assertQueue(QUEUE, { durable: true });
      channel.prefetch(1);
      console.log("[payments] connected to RabbitMQ, consuming queue...");

      channel.consume(QUEUE, async (msg) => {
        if (!msg) return;
        const start = Date.now();
        metrics.requests++;

        try {
          const payload = JSON.parse(msg.content.toString());
          const queueTimeMs = Date.now() - payload.createdAt;

          await delay(PAYMENTS_DELAY_MS);

          insertPayment.run(
            payload.orderId,
            "approved",
            queueTimeMs,
            Date.now(),
          );

          const latencyMs = Date.now() - start;
          metrics.totalLatency += latencyMs;
          metrics.minLatency = Math.min(metrics.minLatency, latencyMs);
          metrics.maxLatency = Math.max(metrics.maxLatency, latencyMs);

          log(`process_payment queueTime=${queueTimeMs}ms`, latencyMs);
          channel.ack(msg);
        } catch (err) {
          metrics.errors++;
          const latencyMs = Date.now() - start;
          log("process_payment_error", latencyMs);
          channel.nack(msg, false, false);
        }
      });

      conn.on("close", () => {
        console.warn("[payments] RabbitMQ connection closed, retrying...");
        setTimeout(connectRabbitMQ, RETRY_DELAY);
      });

      break;
    } catch (err) {
      console.warn(
        `[payments] RabbitMQ not ready, retrying in ${RETRY_DELAY}ms...`,
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

app.get("/payments", (_req, res) => {
  const rows = db
    .prepare("SELECT * FROM payments ORDER BY created_at DESC LIMIT 100")
    .all();
  res.json(rows);
});

await connectRabbitMQ();

app.listen(PORT, () => {
  console.log(`[payments] listening on port ${PORT}`);
});
