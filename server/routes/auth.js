import express from "express";
import supabase from "../database/supabaseConfig.js";
const router = express.Router();

router.post("/user/bulk", async (req, res) => {
  const { userIds } = req.body;

  if (!Array.isArray(userIds)) {
    return res.status(400).json({ error: "userIds must be an array" });
  }

  try {
    const { data, error } = await supabase
      .from("auth.users")
      .select("*")
      .in("id", userIds);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
