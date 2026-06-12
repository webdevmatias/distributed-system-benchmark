export const log = (service, operation, latencyMs) => {
  console.log(
    `[${new Date().toISOString()}] [${service}] [${operation}] latency=${latencyMs}ms`,
  );
};
