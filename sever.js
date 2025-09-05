const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("."));

const DATA_FILE = "data.json";

// Load or create data
let DB = { users: {}, groups: {} };
if (fs.existsSync(DATA_FILE)) {
  DB = JSON.parse(fs.readFileSync(DATA_FILE));
} else {
  const hash = crypto.createHash("sha256").update("Sunny2024").digest("hex");
  DB.users["mainadmin"] = { password: hash, email: "admin@example.com", role: "admin", messages: [] };
  fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2));
}

// Save DB helper
function saveDB() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(DB, null, 2));
}

// Hash password
function hashPass(pw) {
  return crypto.createHash("sha256").update(pw).digest("hex");
}

// ===== API =====
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = DB.users[username];
  if (!user) return res.json({ ok: false, msg: "User not found" });
  if (user.password !== hashPass(password)) return res.json({ ok: false, msg: "Wrong password" });
  return res.json({ ok: true, role: user.role });
});

app.post("/createUser", (req, res) => {
  const { currentUser, username, password, email } = req.body;
  if (!DB.users[currentUser] || DB.users[currentUser].role !== "admin") return res.json({ ok: false, msg: "Only admins can create users" });
  if (DB.users[username]) return res.json({ ok: false, msg: "Username exists" });
  DB.users[username] = { password: hashPass(password), email, role: "user", messages: [] };
  saveDB();
  res.json({ ok: true });
});

app.post("/createAdmin", (req, res) => {
  const { currentUser, username, password, email } = req.body;
  if (currentUser !== "mainadmin") return res.json({ ok: false, msg: "Only mainadmin can create admins" });
  if (DB.users[username]) return res.json({ ok: false, msg: "Username exists" });
  DB.users[username] = { password: hashPass(password), email, role: "admin", messages: [] };
  saveDB();
  res.json({ ok: true });
});

app.post("/sendPM", (req, res) => {
  const { from, to, text } = req.body;
  if (!DB.users[to]) return res.json({ ok: false, msg: "Recipient not found" });
  DB.users[to].messages.push({ from, text });
  saveDB();
  res.json({ ok: true });
});

app.get("/inbox/:username", (req, res) => {
  const user = DB.users[req.params.username];
  if (!user) return res.json({ ok: false, msg: "User not found" });
  res.json({ ok: true, messages: user.messages });
});

app.post("/deleteMsg", (req, res) => {
  const { username, index } = req.body;
  const user = DB.users[username];
  if (!user) return res.json({ ok: false, msg: "User not found" });
  if (!user.messages[index]) return res.json({ ok: false, msg: "Invalid index" });
  user.messages.splice(index, 1);
  saveDB();
  res.json({ ok: true });
});

app.post("/createGroup", (req, res) => {
  const { currentUser, name, privacy } = req.body;
  if (!DB.users[currentUser] || DB.users[currentUser].role !== "admin") return res.json({ ok: false, msg: "Only admins can create groups" });
  if (DB.groups[name]) return res.json({ ok: false, msg: "Group exists" });
  DB.groups[name] = { members: [currentUser], admins: [currentUser], messages: [], privacy };
  saveDB();
  res.json({ ok: true });
});

app.post("/groupAction", (req, res) => {
  const { action, actor, groupName, target, text } = req.body;
  const g = DB.groups[groupName];
  if (!g) return res.json({ ok: false, msg: "Group not found" });
  const user = DB.users[actor];
  if (!user || !g.members.includes(actor)) return res.json({ ok: false, msg: "Not a member" });

  if (action === "invite") {
    if (!g.admins.includes(actor)) return res.json({ ok: false, msg: "Only group admins can invite" });
    if (!DB.users[target]) return res.json({ ok: false, msg: "User not found" });
    g.members.push(target);
  } else if (action === "promote") {
    if (!g.admins.includes(actor)) return res.json({ ok: false, msg: "Only group admins can promote" });
    if (!g.members.includes(target)) return res.json({ ok: false, msg: "Target not in group" });
    if (!g.admins.includes(target)) g.admins.push(target);
  } else if (action === "demote") {
    if (!g.admins.includes(actor)) return res.json({ ok: false, msg: "Only group admins can demote" });
    g.admins = g.admins.filter(u => u !== target);
  } else if (action === "kick") {
    if (!g.admins.includes(actor)) return res.json({ ok: false, msg: "Only group admins can kick" });
    if (g.admins.includes(target)) return res.json({ ok: false, msg: "Cannot kick admin" });
    g.members = g.members.filter(u => u !== target);
  } else if (action === "send") {
    if (!g.members.includes(actor)) return res.json({ ok: false, msg: "Not a member" });
    g.messages.push({ from: actor, text });
  } else {
    return res.json({ ok: false, msg: "Unknown action" });
  }
  saveDB();
  res.json({ ok: true });
});

app.get("/groupMessages/:groupName/:username", (req,res)=>{
  const g = DB.groups[req.params.groupName];
  if (!g) return res.json({ ok:false, msg:"Group not found" });
  if (!g.members.includes(req.params.username)) return res.json({ ok:false, msg:"Not a member" });
  res.json({ ok:true, messages:g.messages });
});

app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
