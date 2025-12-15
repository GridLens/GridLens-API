import { Queue } from "bullmq";

const redisUrl = process.env.REDIS_URL ? process.env.REDIS_URL.trim() : null;

if (!redisUrl) {
  console.warn("REDIS_URL not set - AMI queue will not function");
}

let connection = undefined;

if (redisUrl) {
  try {
    const url = new URL(redisUrl);
    const password = url.password ? decodeURIComponent(url.password).trim() : undefined;
    const username = url.username && url.username !== 'default' ? decodeURIComponent(url.username).trim() : undefined;
    
    connection = {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: password,
      username: username,
      tls: url.protocol === 'rediss:' ? {} : undefined
    };
    
    console.log(`[AMI Queue] Connecting to Redis at ${url.hostname}:${url.port}`);
  } catch (err) {
    console.error("Failed to parse REDIS_URL:", err.message);
  }
}

const amiQueue = new Queue("ami", { connection });

export { amiQueue, connection };
