import { Router } from 'express';
import { buildSummary } from '../compose.js';
import { renderSummaryPdf } from '../pdf.js';
import { config } from '../config.js';

const router = Router();

router.get('/summary', async (req, res) => {
  try {
    res.json(await buildSummary({ from: req.query.from, to: req.query.to }));
  } catch (err) {
    console.error('[report-service] composition failed:', err.message);
    res.status(503).json({ error: 'report data temporarily unavailable' });
  }
});

// Same composed data as /summary, streamed back as a downloadable PDF
// instead of JSON — used by the frontend dashboard's "Download PDF" button.
router.get('/summary/pdf', async (req, res) => {
  const { from, to } = req.query;
  let summary;
  try {
    summary = await buildSummary({ from, to });
  } catch (err) {
    console.error('[report-service] composition failed:', err.message);
    return res.status(503).json({ error: 'report data temporarily unavailable' });
  }
  renderSummaryPdf(res, summary, { clinic: config.clinic, from, to });
});

export default router;
