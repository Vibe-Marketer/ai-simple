/**
 * Cron Enrichment Endpoint
 *
 * Designed to be called by Vercel Cron or any external scheduler.
 * Runs batch enrichment for unenriched contacts.
 *
 * Vercel Cron Config (in vercel.json):
 *   { "path": "/api/cron-enrich", "schedule": "0 6 * * *" }
 *
 * Can also be triggered manually via GET request.
 */

const { batchEnrich } = require('../src/pipeline');

module.exports = async function handler(req, res) {
  // Verify cron secret if configured
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const limit = parseInt(req.query?.limit || '20');

  console.log(`[Cron Enrich] Starting batch enrichment (limit: ${limit})`);

  try {
    const results = await batchEnrich({
      limit,
      onlyUnenriched: true,
      pushToFub: true,
      delayMs: 3000,
      listeningConfig: {
        targetAreas: (process.env.TARGET_AREAS || '').split(',').filter(Boolean),
        agentArea: process.env.AGENT_AREA || '',
      },
    });

    console.log(`[Cron Enrich] Complete: ${results.success}/${results.total} successful`);

    return res.status(200).json({
      success: true,
      ...results,
    });
  } catch (err) {
    console.error(`[Cron Enrich] Failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
};
