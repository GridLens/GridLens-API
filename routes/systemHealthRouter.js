import express from 'express';
import mockDb from '../data/mockDb.js';

const router = express.Router();

router.get('/overview', (req, res) => {
  res.json({
    totalMeters: mockDb.meters.total,
    healthyMeters: mockDb.meters.healthy,
    problemMeters: mockDb.meters.problem,
    systemHealthPct: mockDb.meters.systemHealthPct,
    zones: mockDb.zones,
    sampleProblemMeters: mockDb.sampleProblemMeters.slice(0, 3)
  });
});

export default router;
