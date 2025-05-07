const express = require("express");
const fetch = require("node-fetch");
const { parseStringPromise } = require("xml2js");
const WebSocket = require("ws");
const ping = require("ping");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 5000;

// Dossier public pour les fichiers statiques (HTML, JS, etc.)
app.use(express.static(__dirname + '/public'));

// WebSocket Server
const server = app.listen(PORT, () => {
  console.log(`✅ Dashboard en ligne sur le port ${PORT}`);
});
const wss = new WebSocket.Server({ server });

// Statuts initiaux
let slackStatus = { status: 'En attente...', service_status: '', date_updated: '' };
let anydeskStatus = { status: 'En attente...', service_status: '', incidents: [] };
let microsoftAdminStatus = { status: 'En attente...', service_status: '', description: '', date_updated: '' };

// IP à surveiller
const ipAddresses = ['80.14.43.74', '217.128.247.87', '86.214.116.135', '92.173.237.27', '72.14.201.119', '37.58.153.5', '37.58.130.51', '185.149.218.234', '212.84.57.223', '193.252.196.19'];
const ipToCityMap = {
  "80.14.43.74": "Angers", "217.128.247.87": "Nancy", "86.214.116.135": "Montpellier", "92.173.237.27": "Caen",
  "72.14.201.119": "Lyon", "37.58.153.5": "Paris", "37.58.130.51": "Anzin", "185.149.218.234": "Saint-Jeoire Koe",
  "212.84.57.223": "Saint-Jeoire Rez", "193.252.196.19": "Bruz"
};

let pingStatus = {};
ipAddresses.forEach(ip => {
  pingStatus[ip] = { status: 'En attente...', result: '', city: ipToCityMap[ip] || 'Inconnu' };
});

// PING
async function testPing() {
  ipAddresses.forEach(ip => {
    ping.sys.probe(ip, isAlive => {
      const cityName = ipToCityMap[ip] || 'Inconnu'; 
      pingStatus[ip] = {
        status: isAlive ? 'Disponible' : 'Indisponible',
        result: isAlive ? 'En ligne' : 'Hors ligne',
        city: cityName
      };
      console.log(`[Ping Test] ${cityName} (${ip}) : ${pingStatus[ip].result}`);
      broadcastStatus();
    });
  });
}

// Slack
async function updateSlackStatus() {
  try {
    const res = await fetch("https://slack-status.com/api/v2.0.0/current");
    const data = await res.json();
    slackStatus = {
      status: data.status || 'Inconnu',
      service_status: data.status.toLowerCase().includes('ok') ? 'Disponible' : 'Problème détecté',
      date_updated: new Date().toISOString()
    };
    console.log(`[Slack] Status récupéré : ${slackStatus.service_status} (${slackStatus.status})`);
    broadcastStatus();
  } catch (e) {
    console.error("Slack error:", e);
    slackStatus.service_status = 'Problème détecté';
    broadcastStatus();
  }
}

// AnyDesk
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
    console.log(`[AnyDesk] Incidents récents : ${anydeskStatus.incidents.length}`);
    console.log(`[AnyDesk] Status calculé : ${anydeskStatus.service_status}`);
    broadcastStatus();
  } catch (e) {
    console.error("AnyDesk error:", e);
    anydeskStatus.service_status = 'Problème détecté';
    broadcastStatus();
  }
}

// Récupérer et analyser le flux RSS de Microsoft Admin Center Status
async function updateMicrosoftAdminStatus() {
  try {
    const res = await fetch('https://status.cloud.microsoft/feeds/msft_admin_status.xml');  // Lien du flux RSS
    const xml = await res.text();
    const parsed = await parseStringPromise(xml);

    const item = parsed.rss.channel[0].item[0];

    // Extraire le statut et les détails nécessaires
    microsoftAdminStatus = {
      status: item.status[0],  // 'Available' ou autre
      description: item.description[0],  // Description de l'incident ou du statut
      date_updated: new Date(item.pubDate[0]).toISOString()  // Date de la mise à jour
    };

    console.log(`[Microsoft Admin Center] Status récupéré : ${microsoftAdminStatus.status}`);
    console.log(`[Microsoft Admin Center] Description : ${microsoftAdminStatus.description}`);

    // Diffuser le statut à tous les clients WebSocket
    broadcastStatus();
  } catch (e) {
    console.error("Erreur lors de la récupération du statut Microsoft Admin Center : ", e);
  }
}

// Diffuse à tous les clients connectés
function broadcastStatus() {
  const statusData = {
    slack: slackStatus,
    anydesk: anydeskStatus,
    ping: pingStatus,
    microsoftAdmin: microsoftAdminStatus // Ajouter le statut de Microsoft Admin Center ici
  };

  // Diffuser à tous les clients WebSocket
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(statusData));
    }
  });
}

// Routes API
app.get('/api/status', (_, res) => res.json(slackStatus));
app.get('/api/anydesk', (_, res) => res.json(anydeskStatus));
app.get('/api/ping', (_, res) => res.json(pingStatus));
app.get('/api/microsoftAdmin', (_, res) => res.json(microsoftAdminStatus)); // Nouvelle route pour récupérer le statut Microsoft

// Route IP publique
app.get('/ip', (req, res) => {
  https.get('https://api.ipify.org', response => {
    let ip = '';
    response.on('data', chunk => ip += chunk);
    response.on('end', () => res.send(`Adresse IP publique du serveur : ${ip}`));
  }).on('error', (err) => {
    console.error("Erreur récupération IP :", err);
    res.status(500).send("Impossible de récupérer l'adresse IP.");
  });
});

// Lancer les mises à jour régulières
updateSlackStatus();
setInterval(updateSlackStatus, 15000);

updateAnydeskStatus();
setInterval(updateAnydeskStatus, 15000);

updateMicrosoftAdminStatus();
setInterval(updateMicrosoftAdminStatus, 30000);  // Mise à jour toutes les 30 secondes

testPing();
setInterval(testPing, 60000);  // Test ping toutes les minutes
