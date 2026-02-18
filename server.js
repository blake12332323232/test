require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Client, GatewayIntentBits, Partials } = require("discord.js");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // put dashboard.html inside /public

const PORT = process.env.PORT || 3000;

/* ==========================
   DISCORD CLIENT
========================== */

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

bot.once("ready", () => {
  console.log(`Logged in as ${bot.user.tag}`);
});

bot.login(process.env.BOT_TOKEN);

/* ==========================
   ROUTES
========================== */

/* GET GUILDS */
app.get("/guilds", async (req, res) => {
  const guilds = bot.guilds.cache.map(g => ({
    id: g.id,
    name: g.name
  }));
  res.json(guilds);
});

/* GET CHANNELS */
app.get("/channels/:guildId", async (req, res) => {
  try {
    const guild = await bot.guilds.fetch(req.params.guildId);
    const channels = guild.channels.cache
      .filter(c => c.isTextBased())
      .map(c => ({
        id: c.id,
        name: c.name
      }));

    res.json(channels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch channels" });
  }
});

/* GET MEMBERS */
app.get("/members/:guildId", async (req, res) => {
  try {
    const guild = await bot.guilds.fetch(req.params.guildId);
    const members = await guild.members.fetch();

    res.json(
      members.map(m => ({
        id: m.id,
        username: m.user.username
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

/* GET ROLES */
app.get("/roles/:guildId", async (req, res) => {
  try {
    const guild = await bot.guilds.fetch(req.params.guildId);

    res.json(
      guild.roles.cache
        .filter(r => r.name !== "@everyone")
        .map(r => ({
          id: r.id,
          name: r.name
        }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

/* GET MESSAGES */
app.get("/messages/:channelId", async (req, res) => {
  try {
    const channel = await bot.channels.fetch(req.params.channelId);

    if (!channel.isTextBased())
      return res.status(400).json({ error: "Not a text channel" });

    const messages = await channel.messages.fetch({ limit: 50 });

    const formatted = messages.map(m => ({
      id: m.id,
      author: m.author.username,
      avatar: m.author.displayAvatarURL(),
      content: m.content,
      time: m.createdAt
    }));

    res.json(formatted.reverse());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

/* SEND MESSAGE */
app.post("/send-message", async (req, res) => {
  try {
    const { channelId, content } = req.body;

    const channel = await bot.channels.fetch(channelId);
    if (!channel.isTextBased())
      return res.status(400).json({ error: "Not text channel" });

    await channel.send(content);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* ADD ROLE */
app.post("/add-role", async (req, res) => {
  try {
    const { guildId, memberId, roleId } = req.body;

    const guild = await bot.guilds.fetch(guildId);
    const member = await guild.members.fetch(memberId);

    await member.roles.add(roleId);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add role" });
  }
});

/* REMOVE ROLE */
app.post("/remove-role", async (req, res) => {
  try {
    const { guildId, memberId, roleId } = req.body;

    const guild = await bot.guilds.fetch(guildId);
    const member = await guild.members.fetch(memberId);

    await member.roles.remove(roleId);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove role" });
  }
});

/* KICK */
app.post("/kick", async (req, res) => {
  try {
    const { guildId, memberId } = req.body;

    const guild = await bot.guilds.fetch(guildId);
    const member = await guild.members.fetch(memberId);

    await member.kick();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to kick member" });
  }
});

/* BAN */
app.post("/ban", async (req, res) => {
  try {
    const { guildId, memberId } = req.body;

    const guild = await bot.guilds.fetch(guildId);

    await guild.members.ban(memberId);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to ban member" });
  }
});

/* ==========================
   START SERVER
========================== */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
