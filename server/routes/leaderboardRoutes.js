import { Router } from 'express';
import { users } from '../config/mongoCollections.js'; // adjust path if your file lives elsewhere

const router = Router();

/**
 * GET /leaderboard
 * Returns leaderboard from MongoDB
 */
router.get('/', async (req, res) => {
  try {
    const usersCollection = await users();

    const leaderboard = await usersCollection
      .find(
        {},
        {
          projection: {
            _id: 0,
            userName: 1,
            roundWins: 1,
            matchWins: 1,
            // If you store auth0Sub, you can include it for debugging:
            // auth0Sub: 1,
          },
        }
      )
      .sort({ matchWins: -1, roundWins: -1, userName: 1 })
      .toArray();

    // normalize missing fields to 0 so the client never has to guess
    const cleaned = leaderboard.map((u) => ({
      userName: u.userName || 'Unknown',
      roundWins: Number(u.roundWins) || 0,
      matchWins: Number(u.matchWins) || 0,
    }));

    return res.status(200).json(cleaned);
  } catch (e) {
    console.log('GET /leaderboard error:', e);
    return res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
