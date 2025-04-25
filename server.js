const statusElement = document.getElementById('status');

// Utilisation d'un proxy uniquement si nécessaire
const proxy = 'https://cors-anywhere.herokuapp.com/';
const slackStatusAPI = 'https://status.slack.com/api/v2/summary.json';

fetch(proxy + slackStatusAPI)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }
    return response.json(); // Ici, PAS de JSON.parse() nécessaire
  })
  .then(data => {
    const status = data.status.description;
    statusElement.textContent = `Slack est ${status}`;
  })
  .catch(error => {
    console.error('Erreur lors de la récupération du statut:', error);
    statusElement.textContent = "Erreur lors de la récupération du statut.";
  });

