const express = require("express");
const PORT = 3000;
const app = express();

async function slackstatut() {
try {
    const reponse = await fetch("https://slack-status.com/api/v2.0.0/current");
    const rep = await reponse.json();
    rep.date_updated = new Date().toISOString();
    console.log("récupération du statut de slacks...", rep);
    
   
    

}
    catch (erreur) {
        console.error("Erreur du chargement", erreur);
    }
setTimeout(slackstatut,30000);
}
slackstatut();
app.listen(PORT, () => {
    console.log('server en ligne sur http:localhost:${PORT}');
});
app.use(express.static(__dirname + '/pub'));
