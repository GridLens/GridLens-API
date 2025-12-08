import express from 'express';
import mockDb from '../data/mockDb.js';

const router = express.Router();

router.get('/queue', (req, res) => {
  const queue = mockDb.fieldWorkOrders.map(wo => ({
    id: wo.id,
    source: wo.source,
    meterId: wo.meterId,
    feeder: wo.feeder,
    zone: wo.zone,
    issueCode: wo.issueCode,
    summary: wo.summary,
    priority: wo.priority,
    status: wo.status,
    createdAt: wo.createdAt,
    ageDays: wo.ageDays,
    estLossDollars: wo.estimatedRecoveredDollars,
    linkContext: {
      page: "electric-loss",
      params: { meterId: wo.meterId }
    }
  }));
  res.json(queue);
});

router.get('/work-order/:id', (req, res) => {
  const wo = mockDb.fieldWorkOrders.find(w => w.id === req.params.id);
  if (!wo) {
    return res.status(404).json({ error: "Work order not found" });
  }
  res.json({
    id: wo.id,
    source: wo.source,
    meterId: wo.meterId,
    feeder: wo.feeder,
    zone: wo.zone,
    issueCode: wo.issueCode,
    summary: wo.summary,
    priority: wo.priority,
    status: wo.status,
    createdAt: wo.createdAt,
    ageDays: wo.ageDays,
    estLossDollars: wo.estimatedRecoveredDollars,
    type: wo.type,
    location: wo.location,
    assignedTo: wo.assignedTo
  });
});

export default router;
