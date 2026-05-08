require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json());

// ------------------------------
// SUPABASE SETUP
// ------------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ------------------------------
// BASIC HEALTH CHECK
// ------------------------------
app.get("/", (req, res) => {
  res.send("🚀 Server running with Supabase + Socket.IO");
});

// ------------------------------
// API: GET AGENTS (Leaderboard base)
// ------------------------------
app.get("/api/agents", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("agents")
      .select("*");

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error("Agents API Error:", err.message);
    res.status(500).json([]);
  }
});

// ------------------------------
// SOCKET SERVER
// ------------------------------
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  // --------------------------
  // SESSION INIT (optional)
  // --------------------------
  socket.on("init_session", (data) => {
    console.log("Session started:", data);
    io.emit("session_started", data);
  });

  // --------------------------
  // AGENT MOVEMENT (MAIN LOGIC)
  // --------------------------
  socket.on("agent_movement", async (data) => {
    try {
      // Update Supabase
      const { error } = await supabase.from("agents").upsert({
        id: data.agentId,
        lat: data.lat,
        lng: data.lng,
        status: data.status || "ACTIVE",
        battery: data.battery || 100,
        updated_at: new Date(),
      });

      if (error) throw error;

      // Broadcast to all clients
      io.emit("map_update", data);
    } catch (err) {
      console.error("Agent update error:", err.message);
    }
  });

  // --------------------------
  // DISASTER EVENTS
  // --------------------------
  socket.on("create_disaster", (data) => {
    console.log("🌪 Disaster spawned:", data);
    io.emit("disaster_spawned", data);
    io.emit("new_task", data);
  });

  socket.on("mission_complete", (data) => {
    console.log("✅ Mission completed:", data);
    io.emit("disaster_resolved", data);
  });

  // --------------------------
  // LOG EVENTS (stored in Supabase)
  // --------------------------
  socket.on("log_event", async (data) => {
    try {
      await supabase.from("logs").insert([
        {
          session_id: data.sessionId,
          event_type: data.eventType,
          agent_id: data.agentId,
          details: data.details,
          created_at: new Date(),
        },
      ]);
    } catch (err) {
      console.error("Log error:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

// ------------------------------
// START SERVER
// ------------------------------
const PORT = 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on PORT ${PORT}`);
});