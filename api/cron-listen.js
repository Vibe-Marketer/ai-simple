/**
 * Cron Social Listening Endpoint
 *
 * Designed to be called by Vercel Cron or any external scheduler.
 * Scans enriched contacts for new social signals.
 *
 * Vercel Cron Config (in vercel.json):
 *   { "path": "/api/cron-listen", "schedule": "0 8,14,20 * * *" }
 *
 * Runs 3x daily by default to catch timely signals.
 */

const { batchListen } = require('../src/pipeline');

module.exports = async function handler(req, res) {
  // Verify cron secret if configured
  if (process.env.CRON_SECRET) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const limit = parseInt(req.query?.limit || '50');

  console.log(`[Cron Listen] Starting social listening scan (limit: ${limit})`);

  try {
    const alerts = await batchListen({
      limit,
      targetAreas: (process.env.TARGET_AREAS || '').split(',').filter(Boolean),
      agentArea: process.env.AGENT_AREA || '',
      pushToFub: true,
    });

    console.log(`[Cron Listen] Complete: ${alerts.length} alerts generated`);

    return res.status(200).json({
      success: true,
      alertCount: alerts.length,
      alerts: alerts.slice(0, 20), // Return first 20 for brevity
    });
  } catch (err) {
    console.error(`[Cron Listen] Failed: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
};
