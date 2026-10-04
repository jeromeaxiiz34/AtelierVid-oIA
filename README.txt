# 🎬 Atelier Vidéo

Transformez vos images en vidéos animées par IA. **300+ effets** organisés par catégories.

## ✨ Fonctionnalités

- **300+ effets** répartis en 25 catégories (ambiance, transformation, action, danse, super-pouvoirs, etc.)
- **Recherche instantanée** d'effets par nom, description ou ID
- **Presets de prompt** prêts à l'emploi
- **Traitement par lots** illimité avec file d'attente visuelle
- **Anti-veille** intégré (Wake Lock API + fallback iOS)
- **Format portrait 9:16** optimisé pour TikTok/Reels/Shorts
- **100% client-side** — aucune donnée envoyée à un serveur tiers (hors API Agnes)
- **Responsive** mobile et desktop
- **PWA-ready** (installable)

## 🚀 Installation

### 1. Cloner le dépôt

```bash
git clone https://github.com/votre-pseudo/atelier-video.git
cd atelier-video
```

### 2. Servir localement

```bash
# Avec Python
python3 -m http.server 8000

# Ou avec Node.js
npx serve .
```

Ouvrez `http://localhost:8000`

### 3. Configurer la clé API

1. Créez un compte sur [platform.agnes-ai.com](https://platform.agnes-ai.com)
2. Générez une clé API (`sk-...`)
3. Collez-la dans le champ prévu et cliquez **Enregistrer**

## 📁 Structure

```
atelier-video/
├── index.html          # Page principale
├── css/
│   └── style.css       # Styles
├── js/
│   ├── config.js       # Configuration + état global
│   ├── effects.js      # 300+ effets (le cœur du projet)
│   ├── wakelock.js     # Anti-veille
│   ├── api.js          # Communication API
│   ├── ui.js           # Interface + rendu
│   └── app.js          # Pipeline + init
└── assets/
    └── favicon.svg
```

## 🎨 Ajouter un effet

Ouvrez `js/effects.js` et ajoutez une entrée dans `ALL_EFFECTS` :

```javascript
{
    id: 'mon-effet',
    cat: 'ambiance',        // ou 'action', 'dance', etc.
    name: 'Mon Effet',
    emoji: '✨',
    desc: 'Description courte',
    prompt: 'English prompt for the AI. Preserve the subject identity.'
}
```

C'est tout — l'effet apparaît automatiquement dans l'interface.

## 🌐 Déploiement GitHub Pages

1. Poussez le code sur GitHub
2. Settings → Pages → Source : `main` branch, dossier `/ (root)`
3. Votre app est en ligne sur `https://votre-pseudo.github.io/atelier-video/`

## 📜 Licence

MIT — voir `LICENSE`

## 🙏 Crédits

- API : [Agnes AI](https://platform.agnes-ai.com)
- Anti-veille : technique inspirée de [NoSleep.js](https://github.com/richtr/NoSleep.js)