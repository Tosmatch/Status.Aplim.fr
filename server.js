const express = require("express");
const fetch = require("node-fetch");
const { parseStringPromise } = require("xml2js");
const WebSocket = require("ws");
const ping = require("ping");
const http = require("http"); // 👈 Ajouté

const app = express();
const PORT = process.env.PORT || 5000;

// 👉 Sert les fichiers statiques du dossier public
app.use(express.static(__dirname + '/public'));

// 👉 Crée un vrai serveur HTTP
const server = http.createServer(app);

// 👉 WebSocket attaché au serveur HTTP
const wss = new WebSocket.Server({ server });

// ---------------------- ÉTAT DES SERVICES ----------------------

let slackStatus = { status: 'En attente...', service_status: '', date_updated: '' };
let anydeskStatus = { status: 'En attente...', service_status: '', incidents: [] };

const ipAddresses = ['80.14.43.74', '217.128.247.87', '86.214.116.135', '92.173.237.27', '72.14.201.119', '37.58.153.5', '37.58.130.51', '185.149.218.234', '212.84.57.223', '193.252.196.19'];

const ipToCityMap = {
  "80.14.43.74": "Angers", "217.128.247.87": "Nancy", '86.214.116.135': "Montpellier",
  "92.173.237.27": "Caen", "72.14.201.119": "Lyon", "37.58.153.5": "Paris",
  "37.58.130.51": "Anzin", "185.149.218.234": "Saint-Jeoire Koe",
  "212.84.57.223": "Saint-Jeoire Rez", "193.252.196.19": "Bruz"
};

let pingStatus = ipAddresses.reduce((acc, ip) => {
  acc[ip] = { status: 'En attente...', result: '', city: ipToCityMap[ip] || 'Inconnu' };
  return acc;
}, {});

async function testPing() {
  ipAddresses.forEach(ip => {
    ping.sys.probe(ip, (isAlive) => {
      const city = ipToCityMap[ip] || 'Inconnu';
      pingStatus[ip] = {
        status: isAlive ? 'Disponible' : 'Indisponible',
        result: isAlive ? 'En ligne' : 'Hors ligne',
        city 
      };
      console.log(`[Ping] ${city} (${ip}): ${pingStatus[ip].status}`);
      broadcastStatus();
    });
  });
}

async function updateSlackStatus() {
  try {
    const res = await fetch("https://slack-status.com/api/v2.0.0/current");
    const data = await res.json();
    slackStatus = {
      status: data.status || 'Inconnu',
      service_status: data.status.toLowerCase().includes('ok') ? 'Disponible' : 'Problème détecté',
      date_updated: new Date().toISOString()
    };
    broadcastStatus();
  } catch (e) {
    console.error("Slack error:", e);
    slackStatus.service_status = 'Problème détecté';
    broadcastStatus();
  }
}

async function updateAnydeskStatus() {
  try {
    const res = await fetch("https://status.anydesk.com/history.atom");
    const xml = await res.text();
    const parsed = await parseStringPromise(xml);
    const entries = parsed.feed.entry || [];
    const motsCles = ['europe', 'customer portal', 'anydesk account'];

    anydeskStatus.incidents = entries
      .filter(entry => motsCles.some(mot => entry.title[0].toLowerCase().includes(mot)))
      .map(entry => ({
        title: entry.title[0],
        date: entry.updated[0].split('T')[0],
      }));

    const recent = anydeskStatus.incidents.filter(i => {
      const d = new Date(i.date);
      return (Date.now() - d.getTime()) / (1000 * 3600 * 24) <= 7;
    });

    anydeskStatus.service_status = recent.length > 0 ? 'Problème détecté' : 'Disponible';
    broadcastStatus();
  } catch (e) {
    console.error("AnyDesk error:", e);
    anydeskStatus.service_status = 'Problème détecté';
    broadcastStatus();
  }
}

function broadcastStatus() {
  const statusData = {
    slack: slackStatus,
    anydesk: anydeskStatus,
    ping: pingStatus
  };
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(statusData));
    }
  });
}

// ---------------------- TÂCHES PÉRIODIQUES ----------------------

updateSlackStatus();
setInterval(updateSlackStatus, 10000);

updateAnydeskStatus();
setInterval(updateAnydeskStatus, 10000);

testPing();
setInterval(testPing, 60000);

// ---------------------- ROUTES API ----------------------

app.get('/api/status', (_, res) => res.json(slackStatus));
app.get('/api/anydesk', (_, res) => res.json(anydeskStatus));
app.get('/api/ping', (_, res) => res.json(pingStatus));

// ---------------------- LANCEMENT DU SERVEUR ----------------------

server.listen(PORT, () => {
  console.log(`✅ Serveur Web + WebSocket lancé sur le port ${PORT}`);
});
