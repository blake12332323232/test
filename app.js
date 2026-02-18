// ===============================
// Secure WebSocket (Render safe)
// ===============================
const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const socket = new WebSocket(`${protocol}//${location.host}`);

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "log") {
    addLog(`${data.time} - ${data.action}`);
  }
};

// ===============================
// DOM Loaded
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  loadGuilds();
  loadLogs();
});

// ===============================
// Load Servers
// ===============================
async function loadGuilds() {
  try {
    const res = await fetch("/guilds");
    const guilds = await res.json();

    const guildList = document.getElementById("guilds");
    guildList.innerHTML = "";

    guilds.forEach(guild => {
      const li = document.createElement("li");
      li.textContent = guild.name;
      li.onclick = () => {
        loadChannels(guild.id);
        loadMembers(guild.id);
      };
      guildList.appendChild(li);
    });

  } catch (err) {
    console.error("Guild load error:", err);
  }
}

// ===============================
// Load Channels
// ===============================
async function loadChannels(guildId) {
  try {
    const res = await fetch(`/channels/${guildId}`);
    const channels = await res.json();

    const channelList = document.getElementById("channels");
    channelList.innerHTML = "";

    channels.forEach(channel => {
      const li = document.createElement("li");
      li.textContent = channel.name;
      li.onclick = () => {
        document.getElementById("selectedChannel").value = channel.id;
      };
      channelList.appendChild(li);
    });

  } catch (err) {
    console.error("Channel load error:", err);
  }
}

// ===============================
// Load Members
// ===============================
async function loadMembers(guildId) {
  try {
    const res = await fetch(`/members/${guildId}`);
    const members = await res.json();

    const memberList = document.getElementById("members");
    memberList.innerHTML = "";

    members.forEach(member => {
      const li = document.createElement("li");
      li.textContent = member.username;
      li.onclick = () => {
        document.getElementById("selectedMember").value = member.id;
        document.getElementById("selectedGuild").value = guildId;
      };
      memberList.appendChild(li);
    });

  } catch (err) {
    console.error("Member load error:", err);
  }
}

// ===============================
// Send Message
// ===============================
async function sendMessage() {
  const channelId = document.getElementById("selectedChannel").value;
  const message = document.getElementById("messageInput").value;

  if (!channelId || !message) return alert("Select channel and enter message");

  await fetch("/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channelId, message })
  });

  document.getElementById("messageInput").value = "";
}

// ===============================
// Kick Member
// ===============================
async function kickMember() {
  const guildId = document.getElementById("selectedGuild").value;
  const userId = document.getElementById("selectedMember").value;

  if (!guildId || !userId) return alert("Select member");

  await fetch("/kick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, userId })
  });
}

// ===============================
// Ban Member
// ===============================
async function banMember() {
  const guildId = document.getElementById("selectedGuild").value;
  const userId = document.getElementById("selectedMember").value;

  if (!guildId || !userId) return alert("Select member");

  await fetch("/ban", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, userId })
  });
}

// ===============================
// Load Logs
// ===============================
async function loadLogs() {
  try {
    const res = await fetch("/logs");
    const logs = await res.json();

    logs.forEach(log => {
      addLog(`${log.timestamp} - ${log.action}`);
    });
  } catch (err) {
    console.error("Log load error:", err);
  }
}

// ===============================
// Add Log To UI
// ===============================
function addLog(text) {
  const logBox = document.getElementById("logs");
  const div = document.createElement("div");
  div.textContent = text;
  logBox.prepend(div);
}
