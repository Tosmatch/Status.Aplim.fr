const express = require("express");
const fetch = require("node-fetch");  // Importation de node-fetch pour utiliser fetch
const PORT = 5000;
const app = express();

let slackStatus = {
  status: 'En attente...', // Statut par défaut
  date_updated: new Date().toISOString(),
};

// Middleware pour servir les fichiers statiques
app.use(express.static(__dirname + '/public'));

// Récupération du statut de Slack toutes les 30 secondes
async function slackstatut() {
  try {
    const response = await fetch("https://slack-status.com/api/v2.0.0/current");
    const data = await response.json();
    slackStatus = {
      status: data.status || 'Statut inconnu',
      date_updated: new Date().toISOString(),
    };
    console.log("Récupération du statut de Slack...", slackStatus);
  } catch (error) {
    console.error("Erreur du chargement", error);
  }

  setTimeout(slackstatut, 30000); // Réactualisation toutes les 30 secondes
}

// Initialisation de la récupération du statut
slackstatut();

// Définition de la route API pour renvoyer le statut de Slack
app.get("/api/status", (req, res) => {
  res.json(slackStatus);
});

app.listen(PORT, () => {
  console.log(`Serveur en ligne sur http://localhost:${PORT}`);
});


