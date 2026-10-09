import express from 'express';
import cors from 'cors';
import courtSources from './courtSources.js';
import { scrapeAllCourts, ValidationError } from './scraper.js';
import { pool } from './db/pool.js';

const app = express();
app.use(cors());
app.use(express.json());

// --- Database Bookmark Helpers ---
export async function getBookmarks() {
  const { rows } = await pool.query('SELECT court_id FROM bookmarks');
  return new Set(rows.map(r => r.court_id));
}

export async function addBookmark(courtId) {
  await pool.query(
    'INSERT INTO bookmarks (court_id) VALUES ($1) ON CONFLICT (court_id) DO NOTHING',
    [courtId]
  );
}

export async function removeBookmark(courtId) {
  await pool.query('DELETE FROM bookmarks WHERE court_id = $1', [courtId]);
}

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

// Bookmark toggle route connected to PostgreSQL
app.post('/api/courts/:id/bookmark', async (req, res) => {
  try {
    const { id } = req.params;
    const { bookmarked } = req.body;

    if (bookmarked) {
      await addBookmark(id);
    } else {
      await removeBookmark(id);
    }

    res.json({ success: true, id, bookmarked });
  } catch (error) {
    console.error('Failed to update bookmark:', error);
    res.status(500).json({ error: 'Internal Server Error while updating bookmark.' });
  }
});

// Get all saved bookmarks for initial load (Placed BEFORE app.listen)
app.get('/api/bookmarks', async (req, res) => {
  try {
    const bookmarks = await getBookmarks();
    const formatted = Array.from(bookmarks).map(court_id => ({ court_id }));
    res.json(formatted);
  } catch (error) {
    console.error('Failed to fetch bookmarks:', error);
    res.status(500).json({ error: 'Internal Server Error while fetching bookmarks.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});