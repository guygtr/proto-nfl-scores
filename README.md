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

Captures : `screenshots/after-mobile.png` (design actuel), `screenshots/before-mobile.png` (ancien design).

En ligne : https://guygtr.github.io/proto-nfl-scores/ (GitHub Pages : l'app appelle ESPN directement, `site.web.api.espn.com` en premier parce que `site.api.espn.com` est bloqué par CORS dans les navigateurs).

## Design (Altair)
Refonte visuelle selon le skill **Altair (UI/UX)** de GrokBuild, style **GTR-Glass** inspiré de `shared-ui/glass-card.tsx` (verre dépoli `border-white/10`, coins 16 px, grande ombre) et `shared-ui/neon-button.tsx` (bouton neon, variante *tertiary* bleue). HTML/CSS/JS simple, police Inter (Google Fonts), aucune étape de build.

**Tokens** (`style.css`, `:root`) :
- Couleurs : `--c-bg` #070b16, `--c-surface` (blanc 5,5 %), `--c-border` (blanc 10 %), `--c-text` #f1f5fb, `--c-text-muted` #a9b6cc, `--c-accent` #60a5fa, `--c-fav` #fde047 (Mes équipes), `--c-live` #e31837 (en cours), `--c-focus`.
- Espacements `--s-1`…`--s-8` (échelle 4 px) · typo `--t-xs`…`--t-score` · rayons `--r-sm/md/lg/pill` · `--glass-blur`, `--glass-shadow`, `--neon-glow`.
- Z-index : `--z-header` 20 (en-tête collant en verre) < `--z-toast` 40.

**Composants** :
- `index.html` : en-tête collant `.top.glass`, bouton neon `#reload` (icône SVG, `aria-label`), sections `Mes équipes` / `Tous les matchs` (avec compteur), toast `#toast` (`role=status`), lien d'évitement.
- `style.css` : `.carte` (verre), `.carte.fav` (lueur neon jaune), `.carte.live` (barre rouge + badge pulsé), `.badge`, `.team`, `.meta` (puces), `.situation`, squelettes de chargement, `.toast`.
- `app.js` : rendu des cartes (`carte()`, `equipe()`), `toast()` après un rafraîchissement manuel (réussi ou raté), heures en `America/Toronto`.

**Accessibilité** : contrastes WCAG AA (texte secondaire ≈ 8,9:1, badge en cours ≈ 5:1), focus visible jaune, cibles tactiles ≥ 44 px, `aria-label` sur le bouton et les cartes, `prefers-reduced-motion` respecté. Mobile d'abord : 1 colonne, 2 dès 700 px, 3 dès 1000 px.

Captures avant/après : `screenshots/before-mobile.png`, `screenshots/after-mobile.png` (390 × 844).

## Prochaines étapes
- Choisir ses équipes favorites dans la page (sauvegardé dans le navigateur).
- Navigation entre les semaines, séries éliminatoires.
- Détails d'un match : dernier jeu, meneurs statistiques, probabilité de victoire.
- Notification quand les Pats ou les Bills marquent.
- Installer comme app (PWA) sur l'écran d'accueil.
