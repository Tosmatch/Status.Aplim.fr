let countdownTimer = 60;  // Initialisation du temps (60 secondes)
    let countdownInterval;

    // Fonction pour mettre à jour le décompte
    function updateCountdown() {
      const countdownElement = document.getElementById('countdown');
      countdownElement.textContent = `Mise à jour dans : ${countdownTimer}s`;

      // Si le décompte arrive à zéro, rafraîchir les données
      if (countdownTimer === 0) {
        updateStatus();
        countdownTimer = 60;  // Réinitialisation du décompte à 60 secondes
      } else {
        countdownTimer--;
      }
    }

    // Récupérer les données des services
    function updateStatus() {
      // Récupérer le statut de Slack
      fetch('/api/status')
        .then(response => response.json())
        .then(data => {
          const slackStatusElement = document.getElementById('slackStatus');
          const slackTextElement = document.getElementById('slackText');
          
          slackTextElement.textContent = data.service_status;
          if (data.service_status === 'Disponible') {
            slackStatusElement.className = 'status-circle status-ok';  // Pastille verte pour disponible
          } else if (data.service_status === 'Incident détecté') {
            slackStatusElement.className = 'status-circle status-warning';  // Pastille jaune pour incident
          } else {
            slackStatusElement.className = 'status-circle status-error';  // Pastille rouge pour problème
          }
        })
        .catch(error => {
          console.error('Erreur Slack:', error);
          const slackStatusElement = document.getElementById('slackStatus');
          const slackTextElement = document.getElementById('slackText');
          slackTextElement.textContent = 'Problème détecté';
          slackStatusElement.className = 'status-circle status-error';  // En cas d'erreur, pastille rouge
        });
    
      // Récupérer le statut de AnyDesk
      fetch('/api/anydesk')
        .then(response => response.json())
        .then(data => {
          const anydeskStatusElement = document.getElementById('anydeskStatus');
          const anydeskTextElement = document.getElementById('anydeskText');
          
          anydeskTextElement.textContent = data.service_status;
          if (data.service_status === 'Disponible') {
            anydeskStatusElement.className = 'status-circle status-ok';  // Pastille verte pour disponible
          } else if (data.service_status === 'Incident détecté') {
            anydeskStatusElement.className = 'status-circle status-warning';  // Pastille jaune pour incident
          } else {
            anydeskStatusElement.className = 'status-circle status-error';  // Pastille rouge pour problème
          }
        })
        .catch(error => {
          console.error('Erreur AnyDesk:', error);
          const anydeskStatusElement = document.getElementById('anydeskStatus');
          const anydeskTextElement = document.getElementById('anydeskText');
          anydeskTextElement.textContent = 'Problème détecté';
          anydeskStatusElement.className = 'status-circle status-error';  // En cas d'erreur, pastille rouge
        });
    }

    // Mettre à jour les statuts au début et toutes les 60 secondes
    setInterval(updateCountdown, 1000);  // Mise à jour du décompte chaque seconde
    updateStatus();  // Initialisation des statuts dès le début
    setInterval(updateStatus, 10000);  // Mise à jour des statuts toutes les 60 secondes
