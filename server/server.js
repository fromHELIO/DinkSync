import express from 'express';
import cors from 'cors';
import courtSources from './courtSources.js';
import { scrapeAllCourts, ValidationError } from './scraper.js';

const app = express();
app.use(cors());
app.use(express.json());

// --- API Routes ---

// Get court availability (Restored to original working logic)
app.get('/api/courts/check', async (req, res) => {
  try {
    const { date, time } = req.query;

    if (!date || !time) {
      return res.status(400).json({ error: "Please provide both 'date' and 'time' in the query string." });
    }

    const liveCourtData = await scrapeAllCourts(courtSources, date, time);
    res.json(liveCourtData);

  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Failed to scrape courts:', error);
    res.status(500).json({ error: 'Internal Server Error while checking availability.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});