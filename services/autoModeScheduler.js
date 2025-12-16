import { pool } from "../db.js";
import { 
  publishScaleMode, 
  checkBackpressure, 
  getAlignedIntervalTimestamp,
  getNextAlignedInterval
} from "./amiEmulator.js";

const AUTO_CONFIG = {
  tenantId: "DEMO_TENANT",
  meterCount: 25000,
  feederCount: 25,
  batchSize: 500,
  intervalMinutes: 15,
  checkIntervalMs: 60000
};

let lastRunInterval = null;
let lastRunResult = null;
let isRunning = false;
let schedulerTimer = null;

function getLastCompletedInterval() {
  return getAlignedIntervalTimestamp(AUTO_CONFIG.intervalMinutes);
}

async function checkAndRun() {
  if (isRunning) {
    console.log("[AutoMode] Skipping - previous run still in progress");
    return;
  }

  const currentInterval = getLastCompletedInterval();
  const currentIntervalStr = currentInterval.toISOString();

  if (lastRunInterval === currentIntervalStr) {
    return;
  }

  console.log(`[AutoMode] New 15-min interval detected: ${currentIntervalStr}`);

  const backpressure = await checkBackpressure();
  if (backpressure.overLimit) {
    console.warn(`[AutoMode] Skipped due to backpressure (queue depth: ${backpressure.totalPending}/${backpressure.limit})`);
    lastRunResult = {
      status: "skipped-backpressure",
      interval: currentIntervalStr,
      queueDepth: backpressure.totalPending,
      timestamp: new Date().toISOString()
    };
    return;
  }

  isRunning = true;
  
  try {
    console.log(`[AutoMode] Starting publish for interval ${currentIntervalStr}`);
    
    const result = await publishScaleMode({
      tenantId: AUTO_CONFIG.tenantId,
      meterCount: AUTO_CONFIG.meterCount,
      feederCount: AUTO_CONFIG.feederCount,
      batchSize: AUTO_CONFIG.batchSize,
      intervalMinutes: AUTO_CONFIG.intervalMinutes,
      dryRun: false
    });

    lastRunInterval = currentIntervalStr;
    lastRunResult = {
      status: "ok",
      interval: currentIntervalStr,
      jobsEnqueued: result.jobsEnqueued,
      timestamp: new Date().toISOString()
    };

    console.log(`[AutoMode] Publish complete: ${result.jobsEnqueued} jobs enqueued for ${result.computedMeters} meters`);

  } catch (err) {
    console.error(`[AutoMode] Publish failed:`, err.message);
    lastRunResult = {
      status: "failed",
      interval: currentIntervalStr,
      error: err.message,
      timestamp: new Date().toISOString()
    };
  } finally {
    isRunning = false;
  }
}

export function getAutoModeStatus() {
  const currentInterval = getLastCompletedInterval();
  const nextInterval = getNextAlignedInterval(AUTO_CONFIG.intervalMinutes);
  
  return {
    autoModeEnabled: true,
    config: AUTO_CONFIG,
    lastIntervalRunAt: lastRunInterval,
    nextIntervalDueAt: nextInterval.toISOString(),
    lastRunResult: lastRunResult,
    currentAlignedInterval: currentInterval.toISOString()
  };
}

export function startAutoMode() {
  if (schedulerTimer) {
    console.log("[AutoMode] Already running");
    return;
  }

  console.log(`[AutoMode] Starting always-on scheduler (check every ${AUTO_CONFIG.checkIntervalMs / 1000}s)`);
  console.log(`[AutoMode] Config: ${AUTO_CONFIG.meterCount} meters, ${AUTO_CONFIG.feederCount} feeders, ${AUTO_CONFIG.intervalMinutes}-min intervals`);

  checkAndRun();

  schedulerTimer = setInterval(checkAndRun, AUTO_CONFIG.checkIntervalMs);

  console.log("[AutoMode] Scheduler started successfully");
}

export function stopAutoMode() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[AutoMode] Scheduler stopped");
  }
}

startAutoMode();
