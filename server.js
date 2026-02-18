const express = require("express");
const path = require("path");
const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;
const ACCESS_CODE = process.env.ACCESS_CODE;
const BOT_TOKEN = process.env.BOT_TOKEN;

/* ===============================
   DISCORD BOT SETUP
=================================*/

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // REQUIRED
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent     // REQUIRED
  ]
});

bot.on("clientReady", () => {
  console.log(`Bot logged in as ${bot.user.tag}`);
});

bot.login(BOT_TOKEN);

/* ===============================
   DATABASE SETUP
=================================*/

const db = new sqlite3.Database("database.sqlite");

db.run(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT,
    timestamp TEXT
  )
`);

function logAction(action) {
  const time = new Date().toISOString();
  db.run("INSERT INTO logs (action, timestamp) VALUES (?, ?)", [action, time]);
  broadcast({ type: "log", action, time });
}

/* ===============================
   WEBSOCKET SETUP
=================================*/

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

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

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

/* ===============================
   EXPRESS MIDDLEWARE
=================================*/

app.use(express.json());
app.use(express.static(__dirname)); // serve files from ROOT

/* ===============================
   AUTH ROUTE
=================================*/

app.post("/login", (req, res) => {
  const { code } = req.body;
  if (code === ACCESS_CODE) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

/* ===============================
   ROOT ROUTE
=================================*/

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

/* ===============================
   DEBUG ROUTE
=================================*/

app.get("/debug", (req, res) => {
  res.json({
    ready: bot.isReady(),
    guildCount: bot.guilds.cache.size,
    guilds: bot.guilds.cache.map(g => g.name)
  });
});

/* ===============================
   GET SERVERS
=================================*/

app.get("/guilds", (req, res) => {
  const guilds = bot.guilds.cache.map(g => ({
    id: g.id,
    name: g.name
  }));
  res.json(guilds);
});

/* ===============================
   GET CHANNELS
=================================*/

app.get("/channels/:guildId", (req, res) => {
  const guild = bot.guilds.cache.get(req.params.guildId);
  if (!guild) return res.json([]);

  const channels = guild.channels.cache
    .filter(c => c.isTextBased())
    .map(c => ({
      id: c.id,
      name: c.name
    }));

  res.json(channels);
});

/* ===============================
   GET MEMBERS
=================================*/

app.get("/members/:guildId", async (req, res) => {
  const guild = bot.guilds.cache.get(req.params.guildId);
  if (!guild) return res.json([]);

  await guild.members.fetch(); // VERY IMPORTANT

  const members = guild.members.cache.map(m => ({
    id: m.id,
    username: m.user.username
  }));

  res.json(members);
});

/* ===============================
   SEND MESSAGE
=================================*/

app.post("/send", async (req, res) => {
  const { channelId, message } = req.body;

  try {
    const channel = await bot.channels.fetch(channelId);
    if (!channel || !channel.isTextBased())
      return res.status(400).json({ error: "Invalid channel" });

    await channel.send(message);
    logAction(`Message sent to ${channel.name}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   KICK MEMBER
=================================*/

app.post("/kick", async (req, res) => {
  const { guildId, userId } = req.body;

  try {
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    const member = await guild.members.fetch(userId);
    await member.kick();

    logAction(`Kicked ${member.user.username}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   BAN MEMBER
=================================*/

app.post("/ban", async (req, res) => {
  const { guildId, userId } = req.body;

  try {
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    await guild.members.ban(userId);

    logAction(`Banned user ID ${userId}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   GET LOGS
=================================*/

app.get("/logs", (req, res) => {
  db.all("SELECT * FROM logs ORDER BY id DESC LIMIT 50", (err, rows) => {
    if (err) return res.json([]);
    res.json(rows);
  });
});

// ===============================
// GET ROLES
// ===============================
app.get("/roles/:guildId", (req, res) => {
  const guild = bot.guilds.cache.get(req.params.guildId);
  if (!guild) return res.json([]);

  const roles = guild.roles.cache
    .filter(r => r.name !== "@everyone")
    .map(r => ({
      id: r.id,
      name: r.name
    }));

  res.json(roles);
});

// ===============================
// ADD ROLE
// ===============================
app.post("/addRole", async (req, res) => {
  const { guildId, userId, roleId } = req.body;

  try {
    const guild = bot.guilds.cache.get(guildId);
    const member = await guild.members.fetch(userId);
    await member.roles.add(roleId);
    logAction(`Added role to ${member.user.username}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===============================
// REMOVE ROLE
// ===============================
app.post("/removeRole", async (req, res) => {
  const { guildId, userId, roleId } = req.body;

  try {
    const guild = bot.guilds.cache.get(guildId);
    const member = await guild.members.fetch(userId);
    await member.roles.remove(roleId);
    logAction(`Removed role from ${member.user.username}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

