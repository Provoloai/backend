export function getHealth(config: { environment: string; port: string | number }) {
  return {
    uptime: "running",
    version: "1.0.0",
    env: config.environment,
    port: config.port,
  };
}
