import express from "express"
import { pool } from "./db.js"  

const app = express()
app.use(express.json())

// API root
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "gridlens-api" })
}) 

// DB test endpoint
app.get("/api/time", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() as now;");
    res.json({
      status: "ok",
      db_time: result.rows[0].now
    })
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message })
  }
})

// HEALTH CHECK ENDPOINT
app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS time")
    res.json({
      database: "connected",

      db_time: result.rows[0].time
    })
  } catch (err) {
    console.error("Health check error:", err)
    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: err.message
    })
  }
})

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 GridLens API running on port ${port}`);
});
