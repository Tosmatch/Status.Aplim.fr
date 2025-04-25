async function fetchSlackStatus() {
    try {
      const response = await fetch('/api/status');
      if (!response.ok) {
        throw new Error('Erreur lors de la récupération des données');
      }
  
      const data = await response.json();
      const statusElement = document.getElementById('status');
      const dateUpdatedElement = document.getElementById('date-updated');
  
      // Mettre à jour l'affichage avec le statut de Slack
      statusElement.textContent = data.status || "Statut inconnu";
      dateUpdatedElement.textContent = `Mise à jour le : ${new Date(data.date_updated).toLocaleString()}`;
    } catch (error) {
      console.error("Erreur de récupération du statut", error);
      document.getElementById('status').textContent = "Impossible de récupérer le statut de Slack";
      document.getElementById('date-updated').textContent = "";
    }
  }
  
  // Charger le statut au démarrage
  fetchSlackStatus();
  
  // Mettre à jour toutes les 30 secondes
  setInterval(fetchSlackStatus, 30000);
  