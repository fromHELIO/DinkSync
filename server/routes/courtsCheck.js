import express from 'express';
import courtSources from '../courtSources.js';
import { scrapeAllCourts } from '../scraper.js'; // Note: ES modules usually require the .js extension

const router = express.Router();

router.get('/check', async (req, res) => {
  try {
    const courts = await scrapeAllCourts(courtSources, req.query.date, req.query.time);
    res.json(courts);
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    console.error('[courts/check]', error);
    res.status(500).json({ error: 'Could not check court availability' });
  }
});

export default router;