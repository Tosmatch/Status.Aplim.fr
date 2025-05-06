const express = require("express");
const fetch = require("node-fetch");
const { parseStringPromise } = require("xml2js");
const WebSocket = require("ws");
const ping = require("ping");  // Ajout de la bibliothèque ping

const PORT = 5000;
const app = express();

// Dossier public pour les fichiers statiques
app.use(express.static(__dirname + '/public'));

// Créer un serveur WebSocket
const wss = new WebSocket.Server({ noServer: true });

// Statuts des services
let slackStatus = { status: 'En attente...', service_status: '', date_updated: '' };
let anydeskStatus = { status: 'En attente...', service_status: '', incidents: [] };

// Liste des IPs publiques à surveiller (par exemple les box)
const ipAddresses = ['80.14.43.74', '217.128.247.87', '86.214.116.135', '92.173.237.27', '72.14.201.119', '37.58.153.5', '37.58.130.51', '185.149.218.234', '212.84.57.223', '193.252.196.19', ];  // Exemple d'IP à surveiller

// Table de correspondance IP -> Ville
const ipToCityMap = {
  "80.14.43.74": "Angers", "217.128.247.87": "Nancy", '86.214.116.135': "Montpellier", "92.173.237.27": "Caen", "72.14.201.119": "Lyon", "37.58.153.5": "Paris", "37.58.130.51": "Anzin", "185.149.218.234": "Saint-Jeoire Koe", "212.84.57.223": "Saint-Jeoire Rez", "193.252.196.19": "Bruz",   // Remplace l'IP par la ville 
  // Ajoute d'autres correspondances IP -> Ville ici
};

// Statuts de ping
let pingStatus = ipAddresses.reduce((acc, ip) => {
  acc[ip] = { status: 'En attente...', result: '', city: ipToCityMap[ip] || 'Inconnu' };
  return acc;
}, {});

// Fonction de ping pour tester la connectivité des adresses IP
async function testPing() {
  ipAddresses.forEach(ip => {
    ping.sys.probe(ip, (isAlive) => {
      const cityName = ipToCityMap[ip] || 'Inconnu';  // Récupère la ville associée à l'IP
      if (isAlive) {
        pingStatus[ip] = { status: 'Disponible', result: 'En ligne', city: cityName };
      } else {
        pingStatus[ip] = { status: 'Indisponible', result: 'Hors ligne', city: cityName };
      }
      console.log(`[Ping Test] ${cityName} (${ip}): ${pingStatus[ip].result}`);
      // Diffuser le résultat du ping via WebSocket
      broadcastStatus();
    });
  });
}

// 1. Slack
async function updateSlackStatus() {
  try {
    const res = await fetch("https://slack-status.com/api/v2.0.0/current");
    const data = await res.json();
    slackStatus = {
      status: data.status || 'Inconnu',
      service_status: data.status.toLowerCase().includes('ok') ? 'Disponible' : 'Problème détecté',
      date_updated: new Date().toISOString()
    };
    console.log(`[Slack] Mis à jour : ${slackStatus.service_status}`);
    // Envoie la mise à jour à tous les clients WebSocket
    broadcastStatus();
  } catch (e) {
    console.error("Slack error:", e);
    slackStatus.service_status = 'Problème détecté';
    broadcastStatus();
  }
}

// 2. AnyDesk
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
    console.log(`[AnyDesk] Mis à jour : ${anydeskStatus.service_status}`);
    // Envoie la mise à jour à tous les clients WebSocket
    broadcastStatus();
  } catch (e) {
    console.error("AnyDesk error:", e);
    anydeskStatus.service_status = 'Problème détecté';
    broadcastStatus();
  }
}

// Diffuser l'état à tous les clients WebSocket connectés
function broadcastStatus() {
  const statusData = {
    slack: slackStatus,
    anydesk: anydeskStatus,
    ping: pingStatus
  };

  // Envoie la mise à jour à tous les clients WebSocket
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(statusData));
    }
  });
}

// Lancer tout de suite et toutes les 60 secondes
updateSlackStatus();
setInterval(updateSlackStatus, 10000); // Mettre à jour Slack toutes les 10 secondes

updateAnydeskStatus();
setInterval(updateAnydeskStatus, 10000); // Mettre à jour AnyDesk toutes les 10 secondes

// Effectuer le test de ping toutes les 10 secondes
testPing();
setInterval(testPing, 60000); // Test ping toutes les 10 secondes

// Récupérer les données des services pour les clients via API
app.get('/api/status', (_, res) => res.json(slackStatus));
app.get('/api/anydesk', (_, res) => res.json(anydeskStatus));
app.get('/api/ping', (_, res) => res.json(pingStatus));

// Permet à WebSocket de fonctionner avec le serveur HTTP existant
app.server = app.listen(PORT, () => {
  console.log(`✅ Dashboard disponible sur http://localhost:${PORT}`);
});

app.server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});
