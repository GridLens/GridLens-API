import express from 'express';
import mockDb from '../data/mockDb.js';

const router = express.Router();

router.get('/overview', (req, res) => {
  res.json({
    totalMeters: mockDb.meters.total,
    healthyMeters: mockDb.meters.healthy,
    problemMeters: mockDb.meters.problem,
    systemHealthPct: mockDb.meters.systemHealthPct,
    systemHealthPercent: mockDb.meters.systemHealthPct,
    zones: mockDb.zones,
    percentHealthyByZone: mockDb.zones.map(z => ({
      zone: z.zone,
      percentHealthy: z.healthyPct
    }))
  });
});

router.get('/feeders', (req, res) => {
  const feeders = mockDb.feeders.map(f => ({
    feeder: f.feeder,
    name: f.feeder,
    zone: f.zone,
    lossPct: f.lossPct,
    loss_percent: f.lossPct,
    lossKWh: f.lossKWh,
    loss_kwh: f.lossKWh,
    lossDollars: f.lossDollars,
    loss_dollars: f.lossDollars,
    activeWorkOrders: f.activeWorkOrders,
    active_work_orders: f.activeWorkOrders
  }));
  res.json(feeders);
});

router.get('/suspicious-meters', (req, res) => {
  res.json(mockDb.suspiciousMeters);
});

router.get('/fieldops', (req, res) => {
  const fieldops = mockDb.fieldWorkOrders.map(wo => ({
    id: wo.id,
    meterId: wo.meterId,
    type: wo.type,
    location: wo.location,
    zone: wo.zone,
    status: wo.status,
    priority: wo.priority,
    ageDays: wo.ageDays,
    assignedTo: wo.assignedTo,
    estimatedRecoveredDollars: wo.estimatedRecoveredDollars
  }));
  res.json(fieldops);
});

export default router;
