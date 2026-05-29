import type { Dictionary } from "../dictionaries";

export const fr: Dictionary = {
  // Common
  "common.loading": "Chargement…",
  "common.save": "Enregistrer",
  "common.saving": "Enregistrement…",
  "common.cancel": "Annuler",
  "common.delete": "Supprimer",
  "common.rename": "Renommer",
  "common.dismiss": "Fermer",
  "common.retry": "Réessayer",
  "common.reset": "Réinitialiser",
  "common.clear": "Effacer",
  "common.connect": "Connecter",
  "common.disconnect": "Déconnecter",
  "common.connected": "Connecté",
  "common.add": "Ajouter",
  "common.edit": "Modifier",
  "common.close": "Fermer",
  "common.error": "Une erreur est survenue",
  "common.copyFailed": "Impossible de copier dans le presse-papiers",

  // Sidebar / nav
  "nav.meetings": "Réunions",
  "nav.tasks": "Tâches",
  "nav.calendar": "Calendrier",
  "nav.people": "Personnes",
  "nav.settings": "Paramètres",
  "nav.newFolder": "Nouveau dossier",
  "nav.openSettings": "Ouvrir les paramètres",

  // Top bar / recording
  "recording.start": "Démarrer Scribe",
  "recording.status": "Enregistrement",
  "recording.startEvent": "Démarrer « {title} »",
  "recording.startingEllipsis": "Démarrage…",
  "recording.stop": "Arrêter",
  "recording.stoppingEllipsis": "Arrêt…",
  "recording.linkedTooltip":
    "Lié à « {title} » — démarré il y a {minutes} min",
  "recording.levelMic": "Micro",
  "recording.levelSys": "Sys",
  "recording.micSource": "Microphone",
  "recording.micDefault": "Par défaut (système)",
  "recording.micUnknown": "Microphone",

  // App shell toasts
  "toast.errorTitle": "Une erreur est survenue",
  "toast.dismissError": "Fermer l'erreur",
  "toast.autoLinkedOne": "1 intervenant lié automatiquement",
  "toast.autoLinkedMany": "{count} intervenants liés automatiquement",
  "toast.needsReviewSuffix": " · {count} à vérifier",
  "toast.needsReviewSuffixOne": " · 1 à vérifier",
  "toast.autoLinkedDetail": "{names} depuis votre bibliothèque vocale.",
  "toast.reviewInPeople": "Vérifier dans Personnes",
  "toast.systemAudioTitle": "Audio système non capté",
  "toast.systemAudioBody": "Votre micro est bien enregistré, mais pas les autres participants. Autorisez l'enregistrement de l'écran pour Scribe, puis relancez l'enregistrement.",
  "toast.openScreenSettings": "Ouvrir les réglages d'enregistrement de l'écran",

  // Lazy view fallback
  "view.loading": "Chargement…",

  // Meeting empty state
  "meeting.empty.title": "Aucune réunion sélectionnée",
  "meeting.empty.hint":
    "Lancez un nouvel enregistrement depuis la barre latérale, ou choisissez-en une dans la liste.",
  "meeting.tab.summary": "Résumé",
  "meeting.tab.transcript": "Transcription",
  "meeting.tab.tasks": "Tâches",
  "meeting.tab.bullets": "Points clés",
  "meeting.tab.scratchpad": "Bloc-notes",
  "player.play": "Lecture",
  "player.pause": "Pause",
  "player.seek": "Position",
  "player.mute": "Couper le son",
  "player.unmute": "Activer le son",
  "player.volume": "Volume",

  // Summary view
  "summary.copy": "Copier le résumé complet",
  "summary.copied": "Copié !",
  "summary.exec": "Résumé exécutif",
  "summary.overview": "Vue d'ensemble",
  "summary.inDepth": "En détail",
  "summary.topicOne": "{count} sujet",
  "summary.topicMany": "{count} sujets",
  "summary.decisions": "Décisions",
  "summary.empty.title": "Pas encore de résumé",
  "summary.empty.generate":
    "Générez des notes pour produire un résumé approfondi en plusieurs sections.",
  "summary.empty.process":
    "Traitez l'enregistrement pour transcrire et produire les notes en une seule étape.",
  "summary.processing": "Traitement…",
  "summary.generateNotes": "Générer les notes",
  "summary.processMeeting": "Traiter la réunion",

  // Bullet points (Key points tab)
  "bullets.copy": "Copier les points clés",
  "bullets.copied": "Copié !",
  "bullets.empty.title": "Pas encore de points clés",
  "bullets.empty.generate":
    "Traitez l'enregistrement — les points clés sont générés en même temps que les notes.",
  "bullets.empty.regenerate":
    "Régénérez les notes pour produire les points clés de cette réunion.",

  // Scratch pad
  "scratchpad.placeholder":
    "Notez ce que vous voulez — notes, suivis, liens. Enregistré automatiquement.",
  "scratchpad.saving": "Enregistrement…",
  "scratchpad.saved": "Enregistré",

  // Notes / action items (Tasks tab)
  "notes.actionItems": "Actions à mener",
  "notes.empty.title": "Pas encore de tâches",
  "notes.empty.generate":
    "Générez des notes pour extraire les actions par intervenant.",
  "notes.empty.process":
    "Traitez l'enregistrement pour transcrire et extraire les actions.",
  "notes.unassigned": "Non assigné",
  "notes.markDone": "Marquer comme fait",
  "notes.markNotDone": "Marquer comme non fait",

  // Meeting header
  "header.time": "Heure",
  "header.speakers": "Intervenants",
  "header.status": "Statut",
  "header.event": "Événement",
  "header.tags": "Étiquettes",
  "header.pipeline": "Pipeline",
  "header.review": "Vérifier",
  "header.review.oneNeeded": "1 intervenant à confirmer",
  "header.review.manyNeeded": "{count} intervenants à confirmer",
  "header.tagVoices": "Étiqueter les voix",
  "header.hide": "Masquer",
  "header.show": "Afficher",
  "header.reviewVerb": "Vérifier",
  "header.hidePipeline": "Masquer les détails du pipeline",
  "header.meetingActions": "Actions de la réunion",
  "header.reprocess": "Retraiter la réunion",
  "header.process": "Traiter la réunion",
  "header.retranscribe": "Re-transcrire uniquement",
  "header.transcribeOnly": "Transcrire uniquement",
  "header.rediarizeOnly": "Refaire la diarisation",
  "header.regenerate": "Re-générer les notes uniquement",
  "header.generateOnly": "Générer les notes uniquement",
  "header.chooseEvent": "Choisir un événement…",
  "header.addTag": "Ajouter une étiquette",
  "header.titleLabel": "Titre de la réunion",
  "header.deleteConfirmTitle": "Supprimer la réunion ?",
  "header.deleteConfirmDesc":
    "Ceci supprime définitivement l'enregistrement, la transcription et les notes.",

  // Meeting status
  "status.recording": "Enregistrement",
  "status.recorded": "Enregistré",
  "status.transcribing": "Transcription en cours",
  "status.transcribed": "Transcrit",
  "status.diarized": "Intervenants identifiés",
  "status.done": "Terminé",
  "status.error": "Erreur",

  // People
  "people.title": "Personnes",
  "people.countOne": "1 voix",
  "people.countMany": "{count} voix",
  "people.empty.title": "Aucune voix pour l'instant",
  "people.openLastMeeting": "Ouvrir la dernière réunion",
  "people.you": "Vous",
  "people.markAsMe": "C'est moi",
  "people.unmarkMe": "Pas moi",

  // Tasks
  "tasks.title": "Tâches",
  "tasks.toggle.open": "Tâches en cours",
  "tasks.toggle.done": "Tâches terminées",
  "tasks.toggle.all": "Toutes les tâches",
  "tasks.personal.title": "Personnel",
  "tasks.personal.placeholder":
    "Ajoutez une tâche personnelle et appuyez sur Entrée…",
  "tasks.personal.empty": "Aucune tâche personnelle. Ajoutez-en une ci-dessus.",
  "tasks.meetings.title": "Issues des réunions",
  "tasks.meetings.empty": "Aucune action issue des réunions pour le moment.",
  "tasks.delete": "Supprimer la tâche",
  "tasks.openMeeting": "Ouvrir la réunion",
  "tasks.group.overdue": "En retard",
  "tasks.group.today": "Aujourd'hui",
  "tasks.group.thisWeek": "Cette semaine",
  "tasks.group.later": "Plus tard",
  "tasks.group.noDate": "Sans date",
  "tasks.group.todayMeetings": "Réunions d'aujourd'hui",
  "tasks.group.older": "Plus anciennes",
  "tasks.filter.assignee": "Assigné",
  "tasks.filter.anyone": "Tout le monde",
  "tasks.filter.me": "Moi",
  "tasks.filter.priority": "Priorité",
  "tasks.filter.priorityAny": "Toute priorité",
  "tasks.filter.due": "Échéance",
  "tasks.filter.dueAny": "Toute échéance",
  "tasks.filter.search": "Rechercher des tâches…",
  "tasks.filter.reset": "Réinitialiser les filtres",
  "tasks.filter.clear": "Effacer le filtre",
  "tasks.empty.title": "Aucune tâche trouvée",
  "tasks.empty.desc": "Essayez d'effacer la recherche ou de réinitialiser les filtres",
  "tasks.priority.none": "Aucune",
  "tasks.priority.low": "Basse",
  "tasks.priority.medium": "Moyenne",
  "tasks.priority.high": "Haute",
  "tasks.priority.set": "Définir la priorité",
  "tasks.due.set": "Définir la date",
  "tasks.due.tomorrow": "Demain",
  "tasks.due.nextWeek": "Semaine prochaine",
  "tasks.due.custom": "Choisir une date…",
  "tasks.due.clear": "Effacer la date",
  "tasks.add": "Ajouter une tâche",
  "tasks.addPlaceholder": "Nouvelle tâche…",
  "tasks.duplicate": "Dupliquer",
  "tasks.copyAll": "Tout copier",
  "tasks.more": "Plus d'actions",
  "tasks.assignee.set": "Assigner à",

  // Calendar
  "calendar.title": "Calendrier",
  "calendar.notConnected": "Aucun calendrier connecté.",
  "calendar.resync": "Resynchroniser",
  "calendar.resyncing": "Synchronisation…",
  "calendar.view": "Vue du calendrier",
  "calendar.listView": "Vue en liste",
  "calendar.monthView": "Vue mensuelle",
  "calendar.prevMonth": "Mois précédent",
  "calendar.nextMonth": "Mois suivant",
  "calendar.today": "Aujourd'hui",
  "calendar.tomorrow": "Demain",
  "calendar.yesterday": "Hier",

  // Settings — section nav
  "settings.title": "Paramètres",
  "settings.section.general": "Général",
  "settings.section.general.desc": "Préférences de l'application",
  "settings.section.transcription": "Transcription",
  "settings.section.transcription.desc": "Moteur WhisperX",
  "settings.section.ai": "Moteur IA",
  "settings.section.ai.desc": "Notes et résumés",
  "settings.section.templates": "Modèles de notes",
  "settings.section.templates.desc": "Prompts pré-définis par type de réunion",
  "settings.section.speakers": "Étiquettes des intervenants",
  "settings.section.speakers.desc": "Accès à la diarisation",
  "settings.section.voiceLibrary": "Bibliothèque vocale",
  "settings.section.voiceLibrary.desc": "Voix connues",
  "settings.section.calendar": "Calendrier",
  "settings.section.calendar.desc": "Google Agenda",
  "settings.section.claudeMcp": "Intégration Claude",
  "settings.section.claudeMcp.desc": "MCP Claude Desktop / Code",
  "settings.section.about": "À propos",
  "settings.section.about.desc": "Version et liens",

  // Settings — language
  "settings.language.title": "Langue",
  "settings.language.desc":
    "Choisissez la langue de l'interface de Scribe et celle de l'IA qui transcrit et résume vos réunions.",
  "settings.language.display": "Langue d'affichage",
  "settings.language.display.desc": "Langue utilisée dans l'interface de Scribe.",
  "settings.language.ai": "Langue de l'IA",
  "settings.language.ai.desc":
    "Langue utilisée pour la transcription et les notes de réunion. L'auto-détection identifie automatiquement la langue parlée.",
  "settings.language.auto": "Détection automatique",
  "settings.language.placeholder": "Sélectionner…",

  // Settings — appearance
  "settings.appearance.title": "Apparence",
  "settings.appearance.desc":
    "Choisissez un thème ou laissez Scribe suivre votre système.",
  "settings.appearance.theme": "Thème",
  "settings.appearance.theme.desc":
    "Basculez entre clair et sombre, ou suivez le système. Appuyez sur D pour alterner.",
  "settings.appearance.theme.system": "Système",
  "settings.appearance.theme.light": "Clair",
  "settings.appearance.theme.dark": "Sombre",
  "settings.appearance.accent": "Couleur d'accent",
  "settings.appearance.accent.desc":
    "Teinte les liens, boutons et surbrillances de sélection dans l'app.",
  "settings.appearance.accent.indigo": "Indigo",
  "settings.appearance.accent.violet": "Violet",
  "settings.appearance.accent.blue": "Bleu",
  "settings.appearance.accent.teal": "Sarcelle",
  "settings.appearance.accent.emerald": "Émeraude",
  "settings.appearance.accent.amber": "Ambre",
  "settings.appearance.accent.rose": "Rose",
  "settings.appearance.accent.pink": "Rose vif",
  "settings.appearance.sidebarWidth": "Largeur de la barre latérale",
  "settings.appearance.sidebarWidth.desc":
    "Glissez le bord de la barre latérale pour un ajustement précis, ou revenez à la valeur par défaut.",

  // Settings — transcription / WhisperX
  "settings.whisperx.title": "Moteur WhisperX",
  "settings.whisperx.desc":
    "WhisperX offre une bien meilleure qualité que le transcripteur intégré et identifie les intervenants. Environ 2 Go de dépendances Python sont installées localement lors de la première configuration.",
  "settings.whisperx.install": "Installer",
  "settings.whisperx.reinstall": "Réinstaller",
  "settings.whisperx.retry": "Réessayer l'installation",
  "settings.whisperx.status.installed": "Installé et prêt",
  "settings.whisperx.status.installing":
    "Installation… cela peut prendre 3 à 5 minutes",
  "settings.whisperx.status.notInstalled":
    "Non installé — Scribe utilise le transcripteur intégré",
  "settings.whisperx.status.error": "Erreur",
  "settings.whisperx.status.checking": "Vérification…",
  "settings.whisperx.preparing": "Préparation…",

  // Settings — speakers / HF token
  "settings.hf.title": "Jeton d'accès HuggingFace",
  "settings.hf.descPrefix":
    "Collez un jeton HuggingFace gratuit pour activer l'étiquetage automatique des intervenants. Vous devez d'abord accepter les conditions de",
  "settings.hf.descSuffix":
    ". Stocké chiffré dans le trousseau macOS.",
  "settings.hf.placeholder": "hf_xxxxxxxxxxxxxxxxxxxxxxxx",
  "settings.hf.getToken": "Obtenir un jeton →",

  // Settings — voice library
  "settings.voice.title": "Voix connues",
  "settings.voice.desc":
    "Voix que Scribe a apprises jusqu'à présent. Les nouvelles réunions associent automatiquement les intervenants à cette liste — renommez ou supprimez une entrée pour la réinitialiser.",
  "settings.voice.empty":
    "Aucune voix apprise pour l'instant. Étiquetez les intervenants dans une réunion traitée et elles apparaîtront ici.",
  "settings.voice.meetingOne": "{count} réunion",
  "settings.voice.meetingMany": "{count} réunions",
  "settings.voice.deleteEntry": "Supprimer de la bibliothèque",
  "settings.voice.deleteTitle": "Supprimer cette voix ?",
  "settings.voice.deleteDesc":
    "Cette entrée quitte votre bibliothèque vocale. Les réunions passées gardent le nom ; les futures ne reconnaîtront plus cette voix automatiquement.",
  "settings.voice.clickToRename": "Cliquer pour renommer",

  // Settings — calendar (OAuth)
  "settings.cal.creds.title": "Identifiants OAuth",
  "settings.cal.creds.desc":
    "Scribe a besoin d'un client OAuth Google personnel pour accéder à votre calendrier. Configuration unique.",
  "settings.cal.creds.checking": "Vérification…",
  "settings.cal.creds.notConfigured": "Pas encore configuré.",
  "settings.cal.creds.showMe": "Voir comment faire",
  "settings.cal.creds.clear": "Effacer les identifiants",
  "settings.cal.accounts.title": "Comptes connectés",
  "settings.cal.accounts.desc":
    "Connectez-vous à un ou plusieurs comptes Google pour importer leurs calendriers.",
  "settings.cal.accounts.needCreds":
    "Ajoutez les identifiants OAuth ci-dessus avant de connecter un compte.",
  "settings.cal.accounts.connect": "Connecter Google Agenda",
  "settings.cal.accounts.waiting": "En attente du navigateur…",
  "settings.cal.accounts.addAnother": "Ajouter un autre compte",
  "settings.cal.accounts.syncNow": "Synchroniser",
  "settings.cal.accounts.disconnect": "Déconnecter",
  "settings.cal.accounts.disconnectTitle": "Déconnecter ce compte ?",
  "settings.cal.accounts.disconnectDesc":
    "Les enregistrements déjà liés sont conservés. Les nouveaux événements de ce compte ne seront plus synchronisés.",
  "settings.cal.accounts.connectedOn": "connecté le {date}",
  "settings.cal.wizard.title": "Configurer Google Agenda",
  "settings.cal.wizard.clientId": "ID client",
  "settings.cal.wizard.clientSecret": "Secret client",
  "settings.cal.wizard.save": "Enregistrer les identifiants",

  // Settings — about
  "settings.about.title": "Scribe",
  "settings.about.desc": "Capture de réunions, en local d'abord.",
  "settings.about.version": "Version",
  "settings.about.version.desc": "Version actuelle sur cette machine.",
  "settings.about.storage": "Stockage",
  "settings.about.storage.desc":
    "Les enregistrements, transcriptions et la bibliothèque vocale sont stockés localement dans ~/Library/Application Support/Scribe.",
  "settings.about.diar": "Modèle de diarisation",
  "settings.about.diar.desc":
    "pyannote/speaker-diarization-3.1 via HuggingFace.",
  "settings.about.diar.link": "Page du modèle →",
  "settings.about.engine": "Moteur de transcription",
  "settings.about.engine.desc": "WhisperX — m-bain/whisperX.",
  "settings.about.engine.link": "GitHub →",

  // Settings — moteur IA
  "settings.ai.title": "Moteur de notes",
  "settings.ai.desc":
    "Choisis comment Scribe rédige les notes de réunion. « Embarqué » tourne entièrement sur ta machine ; Ollama et OpenAI-compatible te permettent d'utiliser n'importe quel modèle local ou distant qui suit leur API.",
  "settings.ai.provider": "Fournisseur",
  "settings.ai.provider.desc": "Moteur actif pour générer les notes.",
  "settings.ai.provider.bundled": "Embarqué (local)",
  "settings.ai.provider.ollama": "Ollama",
  "settings.ai.provider.openai": "OpenAI-compatible",
  "settings.ai.provider.anthropic": "API Anthropic (Claude avec clé API)",
  "settings.ai.provider.claudeCode": "Claude Code (abonnement)",
  "settings.ai.bundled.model": "Modèle",
  "settings.ai.bundled.model.desc":
    "Stocké dans ~/Library/Application Support/Scribe/models. Les modèles plus gros que Gemma 3 (4B) par défaut doivent être téléchargés explicitement avant utilisation.",
  "settings.ai.bundled.downloaded": "Téléchargé",
  "settings.ai.bundled.download": "Télécharger",
  "settings.ai.bundled.downloading": "Téléchargement…",
  "settings.ai.bundled.selected": "Sélectionné",
  "settings.ai.bundled.select": "Sélectionner",
  "settings.ai.bundled.notDownloadedHint":
    "Télécharge ce modèle avant de générer des notes avec.",
  "settings.ai.bundled.downloadFailed": "Échec du téléchargement",
  "settings.ai.bundled.delete": "Décharger",
  "settings.ai.bundled.deleteConfirm": "Confirmer",
  "settings.ai.ollama.endpoint": "Point d'accès",
  "settings.ai.ollama.endpoint.desc":
    "URL de ton serveur Ollama. Par défaut, l'app locale sur le port 11434.",
  "settings.ai.ollama.model": "Modèle",
  "settings.ai.ollama.model.placeholder": "Choisir un modèle",
  "settings.ai.ollama.noModels":
    "Aucun modèle trouvé. Lance `ollama pull <modèle>` puis rafraîchis.",
  "settings.ai.openai.endpoint": "Point d'accès",
  "settings.ai.openai.endpoint.desc":
    "URL de base compatible OpenAI. Fonctionne avec OpenAI, LM Studio, vLLM, OpenRouter, Together, Groq, etc.",
  "settings.ai.openai.apiKey": "Clé API",
  "settings.ai.openai.apiKey.desc":
    "Stockée localement et chiffrée via le trousseau du système.",
  "settings.ai.openai.apiKey.placeholder": "sk-…",
  "settings.ai.openai.apiKey.saved": "Clé enregistrée",
  "settings.ai.openai.model": "Modèle",
  "settings.ai.openai.model.placeholder": "Choisir un modèle",
  "settings.ai.openai.noModels":
    "Aucun modèle renvoyé. Vérifie le point d'accès et la clé, puis rafraîchis.",
  "settings.ai.anthropic.endpoint": "Point d'accès",
  "settings.ai.anthropic.endpoint.desc":
    "URL de base de l'API Anthropic. Par défaut : api.anthropic.com.",
  "settings.ai.anthropic.apiKey": "Clé API",
  "settings.ai.anthropic.apiKey.desc":
    "Stockée localement et chiffrée via le trousseau du système. Obtiens-en une sur console.anthropic.com.",
  "settings.ai.anthropic.apiKey.placeholder": "sk-ant-…",
  "settings.ai.anthropic.apiKey.saved": "Clé enregistrée",
  "settings.ai.anthropic.model": "Modèle",
  "settings.ai.anthropic.model.placeholder": "Choisir un modèle",
  "settings.ai.anthropic.noModels":
    "Aucun modèle renvoyé. Vérifie la clé puis rafraîchis.",
  "settings.ai.kb.label": "Dossier base de connaissances",
  "settings.ai.kb.desc":
    "Chemin absolu d'un dossier que l'agent peut lire pendant la génération des notes. L'agent y cherche et lit des fichiers à la demande via MCP. Laisse vide pour un résumé single-shot.",
  "settings.ai.kb.placeholder": "/Users/toi/Notes",
  "settings.ai.kb.check": "Vérification du dossier",
  "settings.ai.kb.check.desc":
    "Vérifie que le dossier existe, est lisible et contient des fichiers. Gratuit — aucun appel LLM.",
  "settings.ai.kb.check.button": "Vérifier",
  "settings.ai.kb.check.ok": "Tout bon",
  "settings.ai.kb.check.missing": "Chemin introuvable",
  "settings.ai.kb.check.notDir": "Le chemin n'est pas un dossier",
  "settings.ai.kb.check.noAccess": "Non lisible",
  "settings.ai.kb.check.empty": "Aucun fichier lisible",
  "settings.ai.kb.check.error": "Échec de la vérification",
  "settings.ai.kb.check.sample": "ex.",
  "settings.ai.claudeCode.status": "État du CLI",
  "settings.ai.claudeCode.statusDesc":
    "Lance `claude -p` via la CLI Claude Code locale sous ton abonnement Pro/Max. Aucune clé API, pas de facturation au token — la consommation passe par le quota d'abonnement (jusqu'au 15 juin 2026, puis sur un pool de crédits programmatique séparé de 100 $/mois au tarif API).",
  "settings.ai.claudeCode.notInstalled":
    "CLI claude introuvable dans le PATH. Installe Claude Code d'abord.",
  "settings.ai.claudeCode.notAuthed":
    "CLI claude trouvée mais non connectée. Lance `claude login` dans un terminal.",
  "settings.ai.claudeCode.ready": "Prête",
  "settings.ai.claudeCode.model": "Modèle",
  "settings.ai.claudeCode.askOption": "Demander à chaque fois",
  "settings.ai.claudeCode.askDesc":
    "Choisis un modèle avant chaque génération. Pratique pour utiliser Haiku sur les standups et Opus sur les réunions stratégiques sans changer les paramètres à chaque fois.",
  "settings.ai.claudeCode.kbDesc":
    "Chemin absolu d'un dossier que la CLI peut lire. Passé via `--add-dir`. Laisse vide pour aucun accès filesystem additionnel.",
  "settings.ai.claudeCode.usage.title": "Usage",
  "settings.ai.claudeCode.usage.desc":
    "Totaux sur toutes les réunions traitées via Claude Code. Le coût est la valeur API-équivalente renvoyée par la CLI — sous ton abonnement Max actif il est absorbé ; après le 15 juin 2026 il consomme le pool de crédits programmatique.",
  "settings.ai.claudeCode.usage.emptyDesc":
    "Aucune réunion traitée avec ce provider.",
  "settings.ai.test": "Tester la connexion",
  "settings.ai.test.ok": "Connecté",
  "settings.ai.test.fail": "Échec de la connexion",
  "settings.ai.save": "Enregistrer",
  "settings.ai.saved": "Enregistré",
  "settings.ai.clear": "Effacer",

  // Settings — Modèles de notes
  "settings.templates.title": "Modèles de notes",
  "settings.templates.desc":
    "Un modèle, c'est la persona et le focus utilisés par Scribe pour rédiger les notes. Le schéma de sortie (résumé, sections, décisions, action items, tags) est verrouillé — tu modifies la façon de briefer le LLM, pas ce qu'il produit.",
  "settings.templates.default": "Modèle par défaut",
  "settings.templates.default.desc":
    "Utilisé pour toute réunion qui n'a pas son propre modèle choisi.",
  "settings.templates.builtin": "Intégré",
  "settings.templates.custom": "Personnalisé",
  "settings.templates.edit": "Éditer",
  "settings.templates.save": "Enregistrer",
  "settings.templates.cancel": "Annuler",
  "settings.templates.reset": "Réinitialiser",
  "settings.templates.delete": "Supprimer",
  "settings.templates.new": "Nouveau modèle",
  "settings.templates.name": "Nom",
  "settings.templates.name.placeholder": "ex : Onboarding client",
  "settings.templates.instructions": "Instructions",
  "settings.templates.instructions.placeholder":
    "Décris le type de réunion et ce sur quoi le LLM doit se concentrer. Exemple : « Tu résumes un 1:1. Sois honnête sur les préoccupations soulevées. Chaque action item doit avoir un owner clair. »",
  "settings.templates.create": "Créer le modèle",
  "settings.templates.confirmDelete":
    "Supprimer ce modèle ? Les réunions qui l'utilisent reviendront sur le défaut.",
  "settings.templates.useGlobal": "Utiliser le défaut",

  // Settings — intégration Claude (serveur MCP)
  "settings.mcp.title": "Intégration Claude Desktop & Code",
  "settings.mcp.desc":
    "Expose tes réunions Scribe à Claude via le Model Context Protocol. Claude pourra lister, lire, rechercher et résumer tes réunions — en combinant leur contenu avec tout ce qu'il sait par ailleurs (ton vault Obsidian, le web, ton code, etc.).",
  "settings.mcp.status": "Serveur",
  "settings.mcp.status.desc":
    "Indique si le script du serveur MCP est disponible sur le disque.",
  "settings.mcp.status.ready": "Prêt",
  "settings.mcp.status.notBuilt":
    "Pas encore compilé. En dev, lance `npm run build:mcp` puis clique sur Re-vérifier.",
  "settings.mcp.recheck": "Re-vérifier",
  "settings.mcp.scriptPath": "Chemin du serveur",
  "settings.mcp.scriptPath.desc":
    "Chemin absolu du serveur MCP. À utiliser dans ta config Claude.",
  "settings.mcp.snippet": "Extrait de configuration",
  "settings.mcp.snippet.desc":
    "Fusionne ceci dans claude_desktop_config.json sous \"mcpServers\".",
  "settings.mcp.snippet.copy": "Copier",
  "settings.mcp.snippet.copied": "Copié",
  "settings.mcp.claudeConfig": "Config Claude Desktop",
  "settings.mcp.claudeConfig.desc":
    "Ouvre le dossier contenant claude_desktop_config.json pour l'éditer.",
  "settings.mcp.claudeConfig.reveal": "Afficher dans le Finder",
  "settings.mcp.allowWrites": "Autoriser Claude à modifier",
  "settings.mcp.allowWrites.desc":
    "Activé, Claude peut réécrire les résumés, ajouter/cocher des action items, retagger les réunions, renommer les speakers et éditer les titres. Chaque modification est tracée dans {userData}/logs/mcp.log. Désactivé par défaut.",
  "settings.mcp.allowWrites.on": "Écriture activée",
  "settings.mcp.allowWrites.off": "Lecture seule",
  "settings.mcp.nodeRequirement":
    "Le serveur MCP utilise le module SQLite intégré de Node — Node 22 ou plus récent est requis. Claude Desktop macOS embarque un Node récent ; si tu vois des erreurs au démarrage, vérifie que `node --version` renvoie 22.x.",

  // Settings — Claude skill
  "settings.mcp.skill.title": "Skill Claude",
  "settings.mcp.skill.desc":
    "Installe la skill `scribe-mcp` globalement pour Claude Desktop et Claude Code. Elle apprend à Claude quand utiliser les outils MCP de Scribe — lister les réunions, réécrire les résumés, ajouter des action items en masse — et comment combiner avec ton vocabulaire Symphonics.",
  "settings.mcp.skill.status": "État",
  "settings.mcp.skill.status.desc":
    "Indique si la skill bundlée correspond à celle installée sous ~/.claude/skills/.",
  "settings.mcp.skill.status.installed": "Installée (à jour)",
  "settings.mcp.skill.status.outdated":
    "La partie Scribe est obsolète. Mettre à jour la rafraîchit en conservant tes ajouts.",
  "settings.mcp.skill.userSection":
    "Section perso détectée : conservée à la mise à jour et ignorée par la vérification d'obsolescence.",
  "settings.mcp.skill.preserved":
    "Mise à jour effectuée. Ta section perso a été conservée.",
  "settings.mcp.skill.backedUp":
    "Mise à jour effectuée. L'ancien fichier n'avait pas de marqueur de section perso, il a été sauvegardé dans :",
  "settings.mcp.skill.status.notInstalled": "Non installée",
  "settings.mcp.skill.status.missing":
    "Skill bundlée introuvable (dev : vérifie que mcp-server/skills/scribe-mcp/SKILL.md existe).",
  "settings.mcp.skill.path": "Chemin d'installation",
  "settings.mcp.skill.path.desc":
    "Emplacement global standard que Claude lit au démarrage.",
  "settings.mcp.skill.actions": "Actions",
  "settings.mcp.skill.actions.desc":
    "Installer copie la skill bundlée dans ~/.claude/skills/. Ta section perso (sous le marqueur) est conservée à la mise à jour. Redémarre Claude Desktop pour appliquer les changements.",
  "settings.mcp.skill.install": "Installer la skill",
  "settings.mcp.skill.update": "Mettre à jour",
  "settings.mcp.skill.upToDate": "À jour",
  "settings.mcp.skill.uninstall": "Désinstaller",
  "settings.mcp.skill.reveal": "Afficher dans le Finder",
  "settings.mcp.skill.bundledMissing":
    "Installation impossible : skill bundlée introuvable. Recompile l'app et réessaie.",

  // Command palette
  "palette.placeholder": "Rechercher des réunions, exécuter des commandes…",
  "palette.searching": "Recherche…",
  "palette.noResults": "Aucun résultat.",
  "palette.openHint": "Recherche et commandes",
  "palette.group.actions": "Actions",
  "palette.group.navigation": "Navigation",
  "palette.group.meetings": "Réunions",
  "palette.group.recent": "Réunions récentes",
  "palette.group.people": "Personnes",
  "palette.group.tags": "Étiquettes",
  "palette.group.folders": "Dossiers",
  "palette.group.preferences": "Préférences",
  "palette.nav.goTo": "Aller à {target}",
  "palette.tab.switch": "Onglet : {tab}",
  "palette.action.processMeeting": "Traiter la réunion en cours",
  "palette.action.clearTagFilter": "Effacer le filtre d'étiquette",
  "palette.action.find": "Rechercher dans la page",
  "palette.matchedIn.title": "Titre",
  "palette.matchedIn.transcript": "Transcription",
  "palette.matchedIn.tag": "Étiquette",
  "palette.matchedIn.summary": "Résumé",
  "palette.theme.light": "Thème : Clair",
  "palette.theme.dark": "Thème : Sombre",
  "palette.theme.system": "Thème : Système",
  "palette.lang.en": "Langue : English",
  "palette.lang.fr": "Langue : Français",
  "palette.lang.es": "Langue : Español",
  "palette.lang.de": "Langue : Deutsch",

  // Barre supérieure
  "topbar.refresh": "Actualiser la page",

  // Recherche dans la page (Cmd+F)
  "find.placeholder": "Rechercher dans la page",
  "find.matches": "{current} sur {total}",
  "find.noMatches": "Aucun résultat",
  "find.previous": "Résultat précédent",
  "find.next": "Résultat suivant",
  "find.matchCase": "Respecter la casse",
  "find.close": "Fermer la recherche",

  // Pipeline badges (meeting header)
  "pipeline.transcribe": "Transcription",
  "pipeline.align": "Alignement",
  "pipeline.diarize": "Diarisation",
  "pipeline.notes": "Notes",

  // Usage badges (meeting header)
  "usage.kb": "KB",
  "usage.calls": "{count} appels",
  "usage.sub": "abo",
  "usage.tip.model": "Modèle : {value}",
  "usage.tip.input": "Entrée : {value}",
  "usage.tip.output": "Sortie : {value}",
  "usage.tip.cacheRead": "Lecture cache : {value}",
  "usage.tip.cacheWrite": "Écriture cache : {value}",
  "usage.tip.cost": "Coût : {value}",
  "usage.tip.costSub": " (au tarif API ; absorbé par l'abonnement)",
  "usage.tip.turns": "Tours : {value}",
  "usage.tip.duration": "Durée : {value}s",
  "usage.tip.session": "Session : {value}",

  // Claude Code usage stats (settings)
  "settings.ai.claudeCode.usage.meetings": "Réunions",
  "settings.ai.claudeCode.usage.tokens": "Tokens entrée / sortie",
  "settings.ai.claudeCode.usage.cacheRead": "Lecture cache",
  "settings.ai.claudeCode.usage.cost": "Coût (équiv. API)",
  "settings.ai.claudeCode.usage.avg": "Moy. / réunion",
  "settings.ai.claudeCode.usage.totalTime": "Temps total",
  "settings.ai.claudeCode.usage.lastRun": "Dernière exécution",

  // Relative time
  "time.justNow": "à l'instant",
  "time.minAgo": "il y a {value} min",
  "time.hoursAgo": "il y a {value} h",
  "time.daysAgoShort": "il y a {value} j",
  "time.daysAgo": "il y a {count} jours",

  // Common additions
  "common.email": "E-mail",
  "common.plusMore": "+{count} de plus",

  // People view
  "people.heardInOne": "Entendu dans 1 réunion",
  "people.heardInMany": "Entendu dans {count} réunions",
  "people.lastOn": "dernière le {date}",
  "people.delete.title": "Supprimer cette voix ?",
  "people.delete.body":
    "« {name} » sera retiré de votre bibliothèque vocale. Les réunions passées conservent le nom du locuteur, mais les futures réunions ne reconnaîtront plus automatiquement cette voix. Vous pouvez recréer l'entrée en la taguant à nouveau.",

  // Processing — steps
  "processing.step.mixAudio": "Mixage audio",
  "processing.step.alignWords": "Aligner les mots",
  "processing.step.identifySpeakers": "Identifier les locuteurs",

  // Processing — stages
  "processing.stage.starting": "Préparation",
  "processing.stage.mixing": "Mixage des pistes audio",
  "processing.stage.loadingRuntime": "Chargement du runtime",
  "processing.stage.loadingAudio": "Lecture de l'audio",
  "processing.stage.loadingModel": "Chargement du modèle Whisper",
  "processing.stage.transcribing": "Transcription de la parole",
  "processing.stage.transcribed": "Transcription prête",
  "processing.stage.loadingAlign": "Chargement de l'aligneur",
  "processing.stage.aligning": "Alignement des horodatages",
  "processing.stage.alignFailed": "Alignement indisponible",
  "processing.stage.loadingDiarize": "Chargement de la diarisation",
  "processing.stage.diarizeLoaded": "Diarisation prête",
  "processing.stage.diarizing": "Détection des locuteurs",
  "processing.stage.diarizeSegments": "Mappage des segments",
  "processing.stage.diarizeAssigned": "Attribution des locuteurs",
  "processing.stage.diarizeFailed": "Diarisation indisponible",
  "processing.stage.diarizeSkipped": "Diarisation ignorée",
  "processing.stage.serializing": "Finalisation de la transcription",
  "processing.stage.model": "Préparation du modèle de langage",
  "processing.stage.loading": "Chargement du modèle de langage",
  "processing.stage.generating": "Rédaction du résumé et des tâches",
  "processing.stage.agent": "Lecture de la base de connaissances",
  "processing.stage.writing": "Enregistrement des notes",

  // Processing — headlines
  "processing.headline.generate": "Génération des notes",
  "processing.headline.transcribe": "Traitement de la transcription",
  "processing.headline.diarize": "Re-diarisation",
  "processing.headline.default": "Traitement de la réunion",

  // Tree (folders / meetings)
  "tree.autoTagTooltip": "Tag auto : #{name}",
  "tree.autoTagAria": "Tag auto : {name}",
  "tree.newFolderInside": "Nouveau dossier ici",
  "tree.startMeetingInFolder": "Démarrer une réunion dans le dossier",
  "tree.deleteFolder": "Supprimer le dossier",
  "tree.deleteFolderConfirm":
    "Supprimer « {name} » ? Les réunions à l'intérieur remonteront d'un niveau.",
  "tree.pinToTop": "Épingler en haut",
  "tree.unpin": "Désépingler",
  "tree.deleteMeetingConfirm":
    "Supprimer « {name} » ? L'enregistrement, la transcription et les notes seront définitivement supprimés.",
  "tree.deleteMeeting": "Supprimer la réunion",
  "tree.changeAutoTag": "Modifier le tag auto",
  "tree.setAutoTag": "Définir un tag auto",
  "tree.autoTag": "Tag auto",
  "tree.autoMoveHeading": "Déplacer auto si tagué avec",
  "tree.noTagsYet": "Aucun tag pour l'instant — créez-en un depuis une réunion.",

  // Pinned section
  "pinned.heading": "Épinglés",

  // Calendar events
  "event.join": "Rejoindre",

  // Linked event row
  "linkedEvent.unlink": "Délier",
  "linkedEvent.notLinked": "Non lié à un événement d'agenda",
  "linkedEvent.autoLink": "Lier auto",
  "linkedEvent.dialogTitle": "Lier cette réunion à un événement d'agenda",
  "linkedEvent.dialogDesc":
    "Événements à ±24 h de l'enregistrement, classés par score de correspondance. Le score tient compte du chevauchement et de la similarité des titres.",
  "linkedEvent.filterPlaceholder": "Filtrer par titre…",
  "linkedEvent.loadingCandidates": "Chargement des candidats…",
  "linkedEvent.noCandidates":
    "Aucun événement correspondant à proximité. Essayez de synchroniser votre agenda.",

  // Tags section
  "tagsSection.show": "Afficher les tags",
  "tagsSection.hide": "Masquer les tags",
  "tagsSection.newTag": "Nouveau tag",
  "tagsSection.clear": "effacer",
  "tagsSection.auto": "auto",
  "tagsSection.deleteTag": "Supprimer le tag {name}",
  "tagsSection.tagNamePlaceholder": "nom du tag",

  // Tag chips
  "tagChips.placeholder": "nom du tag…",
  "tagChips.autoFromNotes": "Tag auto depuis les notes",
  "tagChips.remove": "Retirer le tag {name}",

  // Speakers chip
  "speakersChip.manage": "Gérer les locuteurs",
  "speakersChip.needReviewOne": "1 locuteur à vérifier",
  "speakersChip.needReviewMany": "{count} locuteurs à vérifier",
  "speakersChip.linked": "{linked} sur {total} liés à votre bibliothèque vocale",

  // Sample audio
  "sample.failed": "Échec du chargement de l'extrait",
  "sample.unavailable": "Aucun extrait disponible",
  "sample.play": "Écouter l'extrait",

  // Model prompt dialog
  "modelPrompt.title": "Choisir un modèle",
  "modelPrompt.desc":
    "Claude (abonnement) demande à chaque fois. Choisissez un modèle pour : {intent}.",

  // Meeting notification (floating window)
  "notification.startsInMin": "Commence dans {count} min",
  "notification.startsInOne": "Commence dans 1 min",
  "notification.startingNow": "Commence maintenant",
  "notification.startedAgo": "Commencé il y a {count} min",
  "notification.join": "Rejoindre la réunion",

  // Sidebar
  "sidebar.resize": "Redimensionner la barre latérale (actuel {width}px, min {min}, max {max})",

  // Transcript view
  "transcript.speaker": "Intervenant",
  "transcript.jumpTo": "Aller à ce moment",
  "transcript.empty.title": "Pas encore de transcription",
  "transcript.empty.body":
    "Lancez le pipeline complet (transcription + notes), ou transcrivez seulement et rédigez les notes ailleurs — par ex. via Claude Code en MCP.",

  // Calendar view
  "calendar.empty.list":
    "Aucun événement dans les 60 prochains jours. Cliquez sur l'icône de rafraîchissement pour synchroniser.",
  "calendar.past": "Passé",
  "calendar.eventOne": "{count} événement",
  "calendar.eventMany": "{count} événements",
  "calendar.empty.upcoming": "Rien à venir. Les événements passés sont au-dessus.",
  "calendar.recordedTooltip": "Un enregistrement Scribe est lié à cet événement",

  // Event popover
  "eventPopover.openNotes": "Ouvrir les notes",
  "eventPopover.noRecording": "Aucun enregistrement Scribe lié pour l'instant.",

  // Anthropic model picker
  "modelPicker.required": "· requis",
  "modelPicker.placeholder": "Choisir un modèle…",
  "modelPicker.default": "{model} (par défaut)",

  // Voice tagging panel
  "voicePanel.unknownOne": "{count} voix inconnue",
  "voicePanel.unknownMany": "{count} voix inconnues",
  "voicePanel.close": "Fermer le panneau des locuteurs",
  "voicePanel.empty.noSpeakers":
    "Aucun locuteur détecté. Lancez l'étape de diarisation ci-dessus — si vous connaissez le nombre de personnes, indiquez-le d'abord pour un bien meilleur résultat.",
  "voicePanel.empty.noToken":
    "Ajoutez un token Hugging Face dans les réglages, puis re-diarisez cette réunion pour étiqueter les voix.",
  "voicePanel.searchPlaceholder": "Rechercher ou créer un contact…",
  "voicePanel.assign": "Attribuer à {name}",
  "voicePanel.audioOnly": "Extrait audio uniquement",
  "voicePanel.hidePicker": "Masquer le sélecteur",
  "voicePanel.reassign": "Réattribuer le contact",
  "voicePanel.createContact": "Ajouter « {query} »",
  "voicePanel.notSpeaker": "Pas un vrai locuteur",
  "voicePanel.noMatch": "Aucun résultat pour « {query} ».",
  "voicePanel.invitees": "Invités",
  "voicePanel.recentContacts": "Contacts récents",

  // Meeting header — flows & speaker prompt dialog
  "header.flow.transcribe.title": "Transcrire la réunion",
  "header.flow.transcribe.desc":
    "Pyannote surestime souvent le nombre de locuteurs — indiquez le nombre exact pour verrouiller son regroupement. Laissez vide pour une estimation.",
  "header.flow.rediarize.title": "Re-diariser les locuteurs",
  "header.flow.rediarize.desc":
    "Combien de personnes ont parlé ? Relancer avec un nombre exact donne un regroupement nettement plus propre. Laissez vide pour que pyannote estime.",
  "header.flow.rediarize.confirm": "Re-diariser",
  "header.flow.process.desc":
    "Transcrire + diariser + résumer. Indiquer le nombre exact de locuteurs en amont donne à pyannote un regroupement bien plus précis que son estimation par défaut. Laissez vide pour estimer.",
  "header.flow.process.confirm": "Traiter",
  "header.dialog.template": "Modèle de notes",
  "header.dialog.templateDefault": "Par défaut",
  "header.dialog.speakerCount": "Nombre de locuteurs",
  "header.dialog.detected": "· détectés actuellement : {count}",
  "header.dialog.speakerCountPlaceholder": "ex. 9",

  // Tasks count
  "tasks.countOne": "{count} tâche",
  "tasks.countMany": "{count} tâches",
};
