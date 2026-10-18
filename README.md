# proto-nfl-scores 🏈

## L'idée
Un tableau des pointages NFL en direct, simple et pensé pour le cellulaire.
- Tous les matchs de la semaine : logos, pointage, statut (à venir avec l'heure de Montréal/Toronto, en cours avec le quart et le temps, final), ligne de pari quand elle existe, réseau télé.
- Section **⭐ Mes équipes** en haut : Patriots de la Nouvelle-Angleterre et Bills de Buffalo, mises en évidence.
- Rafraîchissement automatique aux 30 secondes, indicateur « Mis à jour à HH:MM », matchs en cours affichés en premier.
- Données : API publique (non officielle) du tableau des pointages d'ESPN, sans clé.

## Comment lancer
Python 3, aucune dépendance :

```bash
python3 server.py        # puis ouvrir http://localhost:8000
python3 server.py 8080   # autre port
```

`server.py` sert la page et relaie `/api/scoreboard` vers ESPN. Ce relais existe parce qu'ESPN n'envoie pas toujours l'en-tête CORS, donc un appel direct depuis le navigateur peut être bloqué. Si la page est servie autrement (ex. `python3 -m http.server`), l'app essaie quand même ESPN en direct.

Pour l'ouvrir sur ton cell : lance le serveur sur un ordi du même réseau Wi-Fi et va à `http://<ip-de-l-ordi>:8000`.

Captures : `screenshots/mobile.png`, `screenshots/desktop.png` (+ versions `-full`).

## Prochaines étapes
- Choisir ses équipes favorites dans la page (sauvegardé dans le navigateur).
- Navigation entre les semaines, séries éliminatoires.
- Détails d'un match : dernier jeu, meneurs statistiques, probabilité de victoire.
- Notification quand les Pats ou les Bills marquent.
- Installer comme app (PWA) sur l'écran d'accueil.
- Hébergement (à décider plus tard — rien n'est publié pour l'instant).
