import express from "express";
import supabase from "../database/supabaseConfig.js";
const router = express.Router();

router.post("/user/bulk", async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds)) {
    return res.status(400).json({ error: "userIds must be an array" });
  }

  try {
    // Query the 'auth.users' table (note the schema 'auth')
    const { data, error } = await supabase
      .from("auth.users") // <-- query the auth.users table
      .select("*")
      .in("id", userIds);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data); // returns an array of user objects from auth
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
