const express = require("express");
const fetch = require("node-fetch");
const { parseStringPromise } = require("xml2js");
const WebSocket = require("ws://status-aplim-fr.onrender.com/");
const ping = require("ping");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.static(__dirname + "/public"));

let slackStatus = { status: "En attente...", service_status: "", date_updated: "" };
let anydeskStatus = { status: "En attente...", service_status: "", incidents: [] };

const ipAddresses = [
  "80.14.43.74", "217.128.247.87", "86.214.116.135",
  "92.173.237.27", "72.14.201.119", "37.58.153.5",
  "37.58.130.51", "185.149.218.234", "212.84.57.223", "193.252.196.19"
];

const ipToCityMap = {
  "80.14.43.74": "Angers", "217.128.247.87": "Nancy", "86.214.116.135": "Montpellier",
  "92.173.237.27": "Caen", "72.14.201.119": "Lyon", "37.58.153.5": "Paris",
  "37.58.130.51": "Anzin", "185.149.218.234": "Saint-Jeoire Koe",
  "212.84.57.223": "Saint-Jeoire Rez", "193.252.196.19": "Bruz"
};

let pingStatus = ipAddresses.reduce((acc, ip) => {
  acc[ip] = { status: "En attente...", result: "", city: ipToCityMap[ip] || "Inconnu" };
  return acc;
}, {});

async function testPing() {
  for (const ip of ipAddresses) {
    try {
      const res = await ping.promise.probe(ip);
      const city = ipToCityMap[ip] || "Inconnu";
      pingStatus[ip] = {
        status: res.alive ? "Disponible" : "Indisponible",
        result: res.alive ? "En ligne" : "Hors ligne",
        city
      };
      console.log(`[Ping] ${city} (${ip}) : ${pingStatus[ip].result}`);
    } catch (err) {
      console.error(`[Ping Error] ${ip}:`, err);
    }
  }
  broadcastStatus();
}

async function updateSlackStatus() {
  try {
    const res = await fetch("https://slack-status.com/api/v2.0.0/current");
    const data = await res.json();
    slackStatus = {
      status: data.status || "Inconnu",
      service_status: data.status.toLowerCase().includes("ok") ? "Disponible" : "Problème détecté",
      date_updated: new Date().toISOString()
    };
    console.log(`[Slack] ${slackStatus.service_status}`);
  } catch (err) {
    console.error("Slack API error:", err);
    slackStatus.service_status = "Problème détecté";
  }
  broadcastStatus();
}

async function updateAnydeskStatus() {
  try {
    const res = await fetch("https://status.anydesk.com/history.atom");
    const xml = await res.text();
    const parsed = await parseStringPromise(xml);
    const entries = parsed.feed.entry || [];

    const keywords = ["europe", "customer portal", "anydesk account"];
    anydeskStatus.incidents = entries
      .filter(e => keywords.some(k => e.title[0].toLowerCase().includes(k)))
      .map(e => ({
        title: e.title[0],
        date: e.updated[0].split("T")[0]
      }));

    const recent = anydeskStatus.incidents.filter(i => {
      const d = new Date(i.date);
      return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
    });

    anydeskStatus.service_status = recent.length > 0 ? "Problème détecté" : "Disponible";
    console.log(`[AnyDesk] ${anydeskStatus.service_status}`);
  } catch (err) {
    console.error("AnyDesk API error:", err);
    anydeskStatus.service_status = "Problème détecté";
  }
  broadcastStatus();
}

// WebSocket server
const wss = new WebSocket.Server({ noServer: true });

function broadcastStatus() {
  const data = {
    slack: slackStatus,
    anydesk: anydeskStatus,
    ping: pingStatus
  };

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// API endpoints
app.get("/api/status", (_, res) => res.json(slackStatus));
app.get("/api/anydesk", (_, res) => res.json(anydeskStatus));
app.get("/api/ping", (_, res) => res.json(pingStatus));

// Launch intervals
setInterval(updateSlackStatus, 15000);
setInterval(updateAnydeskStatus, 15000);
setInterval(testPing, 60000);

// Start server
const server = app.listen(PORT, () => {
  console.log(`✅ Serveur en ligne sur le port ${PORT}`);
});

// WebSocket upgrade
server.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, ws => {
    wss.emit("connection", ws, req);
  });
});
