// Fonction pour récupérer et afficher le statut de Slack avec un proxy CORS
function getSlackStatus() {
    const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
    const apiUrl = 'https://slack-status.com/api/v2.0.0/current';

    fetch(proxyUrl + apiUrl)
        .then(response => response.json())
        .then(data => {
            const statusElement = document.getElementById('status');
            if (data.status && data.status.description) {
                statusElement.textContent = `Status: ${data.status.description}`;
            } else {
                statusElement.textContent = "Impossible de récupérer le statut.";
            }
        })
        .catch(error => {
            const statusElement = document.getElementById('status');
            statusElement.textContent = "Erreur lors de la récupération des données.";
            console.error(error);
        });
}

// Appeler la fonction une première fois pour afficher le statut immédiatement
getSlackStatus();

// Rafraîchir le statut toutes les minutes (60 000 ms)
setInterval(getSlackStatus, 60000);
