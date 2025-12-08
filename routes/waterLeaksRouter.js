import express from 'express';
import mockDb from '../data/mockDb.js';

const router = express.Router();

router.get('/overview', (req, res) => {
  const candidates = mockDb.waterLeakCandidates;
  const totalLoss = candidates.reduce((sum, c) => sum + c.estLossDollars, 0);
  const avgRisk = candidates.reduce((sum, c) => sum + c.riskScore, 0) / candidates.length;
  const topLoss = candidates.reduce((max, c) => c.estLossDollars > max.estLossDollars ? c : max, candidates[0]);

  res.json({
    totalEstimatedLossDollars: Math.round(totalLoss * 100) / 100,
    candidateCount: candidates.length,
    topLossSample: {
      meterId: topLoss.meterId,
      lossDollars: topLoss.estLossDollars
    },
    avgRiskScore: Math.round(avgRisk * 100) / 100
  });
});

router.get('/candidates', (req, res) => {
  res.json(mockDb.waterLeakCandidates);
});

export default router;
