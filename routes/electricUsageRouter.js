import express from 'express';
import mockDb from '../data/mockDb.js';

const router = express.Router();

router.get('/overview', (req, res) => {
  res.json(mockDb.electricUsage);
});

router.get('/trend', (req, res) => {
  res.json(mockDb.electricTrend);
});

router.get('/zones', (req, res) => {
  res.json(mockDb.electricZones);
});

router.get('/top-loss-points', (req, res) => {
  res.json(mockDb.topLossPoints);
});

export default router;
