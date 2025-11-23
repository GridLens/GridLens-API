import { pool } from "./db.js"
async function testDB() {
  try {
    const result = await pool.query("SELECT NOW() as now;")
     console.log("✅ Connected! DB time:", result.rows[0].now)
    } catch (err) {
     console.error("❌ Connection failed:", err.message)
      } finally {
     await pool.end();
     }
  }
testDB()