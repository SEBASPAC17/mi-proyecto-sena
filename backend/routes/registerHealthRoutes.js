function registerHealthRoutes(app, { pool }) {
  app.get("/health", async (req, res) => {
    try {
      await pool.query("SELECT 1");
      return res.json({
        ok: true,
        service: "dinamicash-backend",
        status: "healthy",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return res.status(503).json({
        ok: false,
        service: "dinamicash-backend",
        status: "degraded",
        timestamp: new Date().toISOString()
      });
    }
  });
}

module.exports = registerHealthRoutes;
