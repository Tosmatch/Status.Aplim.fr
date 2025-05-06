const express = require("express");
const fetch = require("node-fetch");
const { parseStringPromise } = require("xml2js");
const WebSocket = require("ws");
const ping = require("ping");

const PORT = process.env.PORT || 5000;
const app = express();

// Dossier public pour les fichiers statiques
app.use(express.static(__dirname + '/public'));

// Créer un serveur HTTP
const server = app.listen(PORT, () => {
  console.log(`✅ Dashboard en ligne sur http://localhost:${PORT} (ou sur l'URL Render)`);
});

// WebSocket attaché au serveur HTTP
const wss = new WebSocket.Server({ server });

// Statuts initiaux
let slackStatus = { status: 'En attente...', service_status: '', date_updated: '' };
let anydeskStatus = { status: 'En attente...', service_status: '', incidents: [] };

// IPs à surveiller
const ipAddresses = ['80.14.43.74', '217.128.247.87', '86.214.116.135', '92.173.237.27', '72.14.201.119', '37.58.153.5', '37.58.130.51', '185.149.218.234', '212.84.57.223', '193.252.196.19'];

const ipToCityMap = {
  "80.14.43.74": "Angers", "217.128.247.87": "Nancy", "86.214.116.135": "Montpellier",
  "92.173.237.27": "Caen", "72.14.201.119": "Lyon", "37.58.153.5": "Paris",
  "37.58.130.51": "Anzin", "185.149.218.234": "Saint-Jeoire Koe",
  "212.84.57.223": "Saint-Jeoire Rez", "193.252.196.19": "Bruz"
};

let pingStatus = ipAddresses.reduce((acc, ip) => {
  acc[ip] = { status: 'En attente...', result: '', city: ipToCityMap[ip] || 'Inconnu' };
  return acc;
}, {});

// --- FONCTIONS ---

async function testPing() {
  ipAddresses.forEach(ip => {
    ping.sys.probe(ip, (isAlive) => {
      const cityName = ipToCityMap[ip] || 'Inconnu';
      pingStatus[ip] = {
        status: isAlive ? 'Disponible' : 'Indisponible',
        result: isAlive ? 'En ligne' : 'Hors ligne',
        city: cityName
      };
      console.log(`[Ping] ${cityName} (${ip}): ${pingStatus[ip].result}`);
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
    console.log(`[Slack] ${slackStatus.service_status}`);
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
        date: entry.updated[0].split('T')[0]
      }));

    const recent = anydeskStatus.incidents.filter(i => {
      const d = new Date(i.date);
      return (Date.now() - d.getTime()) / (1000 * 3600 * 24) <= 7;
    });

    anydeskStatus.service_status = recent.length > 0 ? 'Problème détecté' : 'Disponible';
    console.log(`[AnyDesk] ${anydeskStatus.service_status}`);
    broadcastStatus();
  } catch (e) {
    console.error("AnyDesk error:", e);
    anydeskStatus.service_status = 'Problème détecté';
    broadcastStatus();
  }
}

// Diffusion WebSocket
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

// API REST
app.get('/api/status', (_, res) => res.json(slackStatus));
app.get('/api/anydesk', (_, res) => res.json(anydeskStatus));
app.get('/api/ping', (_, res) => res.json(pingStatus));

// --- LANCEMENT AUTOMATIQUE ---
updateSlackStatus();
updateAnydeskStatus();
testPing();

// Mises à jour périodiques
setInterval(updateSlackStatus, 10000);
setInterval(updateAnydeskStatus, 10000);
setInterval(testPing, 60000);
