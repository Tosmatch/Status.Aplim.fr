const express = require("express");
const axios = require("axios");
const path = require("path");
const cors = require("cors");
const schedule = require("node-schedule");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

let slackStatus = {
    status: "unknown",
    date_updated: new Date().toISOString(),
    services: []
};

// Fonction pour récupérer le statut Slack
async function fetchSlackStatus() {
    try {
        console.log("🔄 Récupération du statut Slack...");
        const response = await axios.get("https://status.slack.com/api/v2.0.0/current");
        
        slackStatus = {
            status: response.data.status,
            date_updated: response.data.date_updated, // Date fournie par Slack
            last_checked: new Date().toISOString(),  // Nouvelle date locale
            services: response.data.services || []
        };

        console.log("✅ Statut mis à jour :", slackStatus);
    } catch (error) {
        console.error("❌ Erreur de récupération du statut:", error.message);
    }
}


// Planifier la récupération toutes les 10 secondes
schedule.scheduleJob("*/30 * * * * *", fetchSlackStatus);

// Route API pour récupérer le statut
app.get("/api/status", (req, res) => {
    res.json(slackStatus);
});

// Route pour servir la page HTML
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Lancer le serveur
app.listen(PORT, () => {
    console.log(`✅ Serveur en ligne : http://localhost:${PORT}`);
    fetchSlackStatus(); // Charger les données au démarrage
});
