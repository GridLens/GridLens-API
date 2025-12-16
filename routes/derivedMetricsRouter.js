import express from 'express';
import {
  getAllDerivedMetrics,
  getMeterHealthIndex,
  getFeederHealthIndex,
  getLastGoodReadAgeDistribution,
  getExceptionVelocity,
  getEstimatedBillingExposure,
  getDataConfidenceIndicator
} from '../services/derivedMetrics.js';

const router = express.Router();

router.get('/all', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || 'DEMO_TENANT';
    const tariff = parseFloat(req.query.tariff) || 0.12;
    const metrics = await getAllDerivedMetrics(tenantId, tariff);
    res.json(metrics);
  } catch (err) {
    console.error('Derived metrics error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/meter-health', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || 'DEMO_TENANT';
    const health = await getMeterHealthIndex(tenantId);
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/feeder-health', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || 'DEMO_TENANT';
    const feeders = await getFeederHealthIndex(tenantId);
    res.json({ feeders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/read-age', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || 'DEMO_TENANT';
    const distribution = await getLastGoodReadAgeDistribution(tenantId);
    res.json(distribution);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/exception-velocity', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || 'DEMO_TENANT';
    const velocity = await getExceptionVelocity(tenantId);
    res.json(velocity);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/billing-exposure', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || 'DEMO_TENANT';
    const tariff = parseFloat(req.query.tariff) || 0.12;
    const exposure = await getEstimatedBillingExposure(tenantId, tariff);
    res.json(exposure);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/data-confidence', async (req, res) => {
  try {
    const tenantId = req.query.tenantId || 'DEMO_TENANT';
    const confidence = await getDataConfidenceIndicator(tenantId);
    res.json(confidence);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
