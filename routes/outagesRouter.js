import express from 'express';
import mockDb from '../data/mockDb.js';

const router = express.Router();

router.get('/overview', (req, res) => {
  res.json(mockDb.outagesOverview);
});

router.get('/active-outages', (req, res) => {
  res.json(mockDb.activeOutages);
});

router.get('/reliability-30d', (req, res) => {
  res.json(mockDb.reliability30d);
});

router.get('/ami-events', (req, res) => {
  res.json(mockDb.amiEvents);
});

router.get('/critical-customers', (req, res) => {
  res.json(mockDb.criticalCustomers);
});

export default router;
