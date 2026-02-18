const express = require("express");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_CODE = process.env.ACCESS_CODE;
const BOT_TOKEN = process.env.BOT_TOKEN;

// --- Discord Bot Setup ---
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

bot.login(BOT_TOKEN);

bot.on("ready", () => {
  console.log(`Bot logged in as ${bot.user.tag}`);
});

// --- SQLite Database Setup ---
const db = new sqlite3.Database("database.sqlite");
db.run(`CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT,
  timestamp TEXT
)`);

// --- WebSocket Server ---
const wss = new WebSocket.Server({ noServer: true });
let sockets = [];

wss.on("connection", (ws) => {
  sockets.push(ws);
  ws.on("close", () => {
    sockets = sockets.filter(s => s !== ws);
  });
});

function broadcast(data) {
  sockets.forEach(ws => ws.send(JSON.stringify(data)));
}

// --- Express Middleware ---
app.use(express.json());

// --- Serve static files from root ---
app.use(express.static(__dirname));

// --- Login Route ---
app.post("/login", (req, res) => {
  const { code } = req.body;
  if (code === ACCESS_CODE) res.json({ success: true });
  else res.status(401).json({ success: false });
});

// --- Redirect / to login.html ---
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// --- Your API routes (guilds, members, send, kick, ban, embed, etc.) ---
app.get("/guilds", (req, res) => {
  const guilds = bot.guilds.cache.map(g => ({ id: g.id, name: g.name }));
  res.json(guilds);
});

app.get("/members/:guildId", async (req, res) => {
  const guild = bot.guilds.cache.get(req.params.guildId);
  if (!guild) return res.status(404).json([]);
  await guild.members.fetch();
  const members = guild.members.cache.map(m => ({
    id: m.id,
    username: m.user.username
  }));
  res.json(members);
});

// Add other routes (channels, send message, kick, ban, embed, execute, logs) the same way...

// --- Start server & attach WebSocket ---
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});
