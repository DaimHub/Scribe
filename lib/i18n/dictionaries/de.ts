import type { Dictionary } from "../dictionaries";

export const de: Dictionary = {
  // Common
  "common.loading": "Wird geladen…",
  "common.save": "Speichern",
  "common.saving": "Wird gespeichert…",
  "common.cancel": "Abbrechen",
  "common.delete": "Löschen",
  "common.rename": "Umbenennen",
  "common.dismiss": "Schließen",
  "common.retry": "Erneut versuchen",
  "common.reset": "Zurücksetzen",
  "common.clear": "Leeren",
  "common.connect": "Verbinden",
  "common.disconnect": "Trennen",
  "common.connected": "Verbunden",
  "common.add": "Hinzufügen",
  "common.edit": "Bearbeiten",
  "common.close": "Schließen",
  "common.error": "Etwas ist schiefgelaufen",
  "common.copyFailed": "Konnte nicht in die Zwischenablage kopieren",

  // Sidebar / nav
  "nav.meetings": "Besprechungen",
  "nav.tasks": "Aufgaben",
  "nav.calendar": "Kalender",
  "nav.people": "Personen",
  "nav.settings": "Einstellungen",
  "nav.newFolder": "Neuer Ordner",
  "nav.openSettings": "Einstellungen öffnen",

  // Top bar / recording
  "recording.start": "Scribe starten",
  "recording.status": "Aufnahme läuft",
  "recording.startEvent": '„{title}“ starten',
  "recording.startingEllipsis": "Wird gestartet…",
  "recording.stop": "Stopp",
  "recording.stoppingEllipsis": "Wird beendet…",
  "recording.linkedTooltip":
    "Verknüpft mit „{title}“ — vor {minutes} Min. gestartet",
  "recording.levelMic": "Mic",
  "recording.levelSys": "Sys",
  "recording.micSource": "Mikrofon",
  "recording.micDefault": "Systemstandard",
  "recording.micUnknown": "Mikrofon",

  // App shell toasts
  "toast.errorTitle": "Etwas ist schiefgelaufen",
  "toast.dismissError": "Fehler schließen",
  "toast.autoLinkedOne": "1 Sprecher automatisch verknüpft",
  "toast.autoLinkedMany": "{count} Sprecher automatisch verknüpft",
  "toast.needsReviewSuffix": " · {count} zu prüfen",
  "toast.needsReviewSuffixOne": " · 1 zu prüfen",
  "toast.autoLinkedDetail": "{names} aus deiner Stimmenbibliothek.",
  "toast.reviewInPeople": "In Personen prüfen",
  "toast.systemAudioTitle": "Systemaudio nicht erfasst",
  "toast.systemAudioBody": "Dein Mikrofon wird aufgenommen, die anderen Teilnehmer jedoch nicht. Erteile Scribe die Berechtigung zur Bildschirmaufnahme und starte die Aufnahme erneut.",
  "toast.openScreenSettings": "Bildschirmaufnahme-Einstellungen öffnen",

  // Lazy view fallback
  "view.loading": "Wird geladen…",

  // Meeting empty state
  "meeting.empty.title": "Keine Besprechung ausgewählt",
  "meeting.empty.hint":
    "Starte eine neue Aufnahme über die Seitenleiste oder wähle eine aus der Liste.",
  "meeting.tab.summary": "Zusammenfassung",
  "meeting.tab.transcript": "Transkript",
  "meeting.tab.tasks": "Aufgaben",
  "meeting.tab.bullets": "Kernpunkte",
  "meeting.tab.scratchpad": "Notizblock",
  "player.play": "Wiedergabe",
  "player.pause": "Pause",
  "player.seek": "Position",
  "player.mute": "Stummschalten",
  "player.unmute": "Stummschaltung aufheben",
  "player.volume": "Lautstärke",

  // Summary view
  "summary.copy": "Gesamte Zusammenfassung kopieren",
  "summary.copied": "Kopiert!",
  "summary.exec": "Executive Summary",
  "summary.overview": "Überblick",
  "summary.inDepth": "Im Detail",
  "summary.topicOne": "{count} Thema",
  "summary.topicMany": "{count} Themen",
  "summary.decisions": "Entscheidungen",
  "summary.empty.title": "Noch keine Zusammenfassung",
  "summary.empty.generate":
    "Notizen generieren, um eine ausführliche, mehrteilige Zusammenfassung zu erstellen.",
  "summary.empty.process":
    "Aufnahme verarbeiten, um in einem Schritt zu transkribieren und Notizen zu erzeugen.",
  "summary.processing": "Wird verarbeitet…",
  "summary.generateNotes": "Notizen generieren",
  "summary.processMeeting": "Besprechung verarbeiten",

  // Bullet points (Key points tab)
  "bullets.copy": "Kernpunkte kopieren",
  "bullets.copied": "Kopiert!",
  "bullets.empty.title": "Noch keine Kernpunkte",
  "bullets.empty.generate":
    "Verarbeite die Aufnahme – die Kernpunkte entstehen zusammen mit den Notizen.",
  "bullets.empty.regenerate":
    "Generiere die Notizen neu, um Kernpunkte für diese Besprechung zu erzeugen.",

  // Scratch pad
  "scratchpad.placeholder":
    "Notiere alles, was du willst – Notizen, To-dos, Links. Wird automatisch gespeichert.",
  "scratchpad.saving": "Wird gespeichert…",
  "scratchpad.saved": "Gespeichert",

  // Notes / action items (Tasks tab)
  "notes.actionItems": "Aktionspunkte",
  "notes.empty.title": "Noch keine Aufgaben",
  "notes.empty.generate":
    "Generiere Notizen, um Aktionspunkte je Sprecher zu extrahieren.",
  "notes.empty.process":
    "Verarbeite die Aufnahme, um zu transkribieren und Aktionspunkte zu extrahieren.",
  "notes.unassigned": "Nicht zugewiesen",
  "notes.markDone": "Als erledigt markieren",
  "notes.markNotDone": "Als nicht erledigt markieren",

  // Meeting header
  "header.time": "Zeit",
  "header.speakers": "Sprecher",
  "header.status": "Status",
  "header.event": "Termin",
  "header.tags": "Tags",
  "header.pipeline": "Pipeline",
  "header.review": "Prüfen",
  "header.review.oneNeeded": "1 Sprecher zu bestätigen",
  "header.review.manyNeeded": "{count} Sprecher zu bestätigen",
  "header.tagVoices": "Stimmen zuordnen",
  "header.hide": "Ausblenden",
  "header.show": "Einblenden",
  "header.reviewVerb": "Prüfen",
  "header.hidePipeline": "Pipeline-Details ausblenden",
  "header.meetingActions": "Aktionen für Besprechung",
  "header.reprocess": "Besprechung neu verarbeiten",
  "header.process": "Besprechung verarbeiten",
  "header.retranscribe": "Nur neu transkribieren",
  "header.transcribeOnly": "Nur transkribieren",
  "header.rediarizeOnly": "Nur erneut diarisieren",
  "header.regenerate": "Nur Notizen neu erzeugen",
  "header.generateOnly": "Nur Notizen erzeugen",
  "header.chooseEvent": "Termin wählen…",
  "header.addTag": "Tag hinzufügen",
  "header.titleLabel": "Besprechungstitel",
  "header.deleteConfirmTitle": "Besprechung löschen?",
  "header.deleteConfirmDesc":
    "Dies löscht die Aufnahme, das Transkript und die Notizen endgültig.",

  // Meeting status
  "status.recording": "Aufnahme",
  "status.recorded": "Aufgezeichnet",
  "status.transcribing": "Wird transkribiert",
  "status.transcribed": "Transkribiert",
  "status.diarized": "Sprecher erkannt",
  "status.done": "Fertig",
  "status.error": "Fehler",

  // People
  "people.title": "Personen",
  "people.countOne": "1 Stimme",
  "people.countMany": "{count} Stimmen",
  "people.empty.title": "Noch keine Stimmen",
  "people.openLastMeeting": "Letzte Besprechung öffnen",
  "people.you": "Du",
  "people.markAsMe": "Das bin ich",
  "people.unmarkMe": "Nicht ich",

  // Tasks
  "tasks.title": "Aufgaben",
  "tasks.toggle.open": "Offene Aufgaben",
  "tasks.toggle.done": "Erledigte Aufgaben",
  "tasks.toggle.all": "Alle Aufgaben",
  "tasks.personal.title": "Persönlich",
  "tasks.personal.placeholder":
    "Persönliche Aufgabe hinzufügen und Enter drücken…",
  "tasks.personal.empty":
    "Keine persönlichen Aufgaben. Füge oben eine hinzu.",
  "tasks.meetings.title": "Aus Besprechungen",
  "tasks.meetings.empty":
    "Noch keine Aktionspunkte aus Besprechungen.",
  "tasks.delete": "Aufgabe löschen",
  "tasks.openMeeting": "Besprechung öffnen",
  "tasks.group.overdue": "Überfällig",
  "tasks.group.today": "Heute",
  "tasks.group.thisWeek": "Diese Woche",
  "tasks.group.later": "Später",
  "tasks.group.noDate": "Ohne Datum",
  "tasks.group.todayMeetings": "Heutige Besprechungen",
  "tasks.group.older": "Älter",
  "tasks.filter.assignee": "Zuständig",
  "tasks.filter.anyone": "Alle",
  "tasks.filter.me": "Ich",
  "tasks.filter.priority": "Priorität",
  "tasks.filter.priorityAny": "Beliebige Priorität",
  "tasks.filter.due": "Fällig",
  "tasks.filter.dueAny": "Beliebiges Datum",
  "tasks.filter.search": "Aufgaben suchen…",
  "tasks.filter.reset": "Filter zurücksetzen",
  "tasks.filter.clear": "Filter entfernen",
  "tasks.empty.title": "Keine Aufgaben gefunden",
  "tasks.empty.desc": "Suche löschen oder Filter zurücksetzen",
  "tasks.priority.none": "Keine",
  "tasks.priority.low": "Niedrig",
  "tasks.priority.medium": "Mittel",
  "tasks.priority.high": "Hoch",
  "tasks.priority.set": "Priorität setzen",
  "tasks.due.set": "Datum setzen",
  "tasks.due.tomorrow": "Morgen",
  "tasks.due.nextWeek": "Nächste Woche",
  "tasks.due.custom": "Datum wählen…",
  "tasks.due.clear": "Datum entfernen",
  "tasks.add": "Aufgabe hinzufügen",
  "tasks.addPlaceholder": "Neue Aufgabe…",
  "tasks.duplicate": "Duplizieren",
  "tasks.copyAll": "Alles kopieren",
  "tasks.more": "Mehr Aktionen",
  "tasks.assignee.set": "Zuweisen an",

  // Calendar
  "calendar.title": "Kalender",
  "calendar.notConnected": "Kein Kalender verbunden.",
  "calendar.resync": "Erneut synchronisieren",
  "calendar.resyncing": "Synchronisierung…",
  "calendar.view": "Kalenderansicht",
  "calendar.listView": "Listenansicht",
  "calendar.monthView": "Monatsansicht",
  "calendar.prevMonth": "Vorheriger Monat",
  "calendar.nextMonth": "Nächster Monat",
  "calendar.today": "Heute",
  "calendar.tomorrow": "Morgen",
  "calendar.yesterday": "Gestern",

  // Settings — section nav
  "settings.title": "Einstellungen",
  "settings.section.general": "Allgemein",
  "settings.section.general.desc": "App-Einstellungen",
  "settings.section.transcription": "Transkription",
  "settings.section.transcription.desc": "WhisperX-Engine",
  "settings.section.ai": "KI-Anbieter",
  "settings.section.ai.desc": "Engine für Notizen & Zusammenfassungen",
  "settings.section.templates": "Notiz-Vorlagen",
  "settings.section.templates.desc": "Prompt-Presets pro Meeting-Typ",
  "settings.section.speakers": "Sprecher-Labels",
  "settings.section.speakers.desc": "Zugriff auf Diarisation",
  "settings.section.voiceLibrary": "Stimmenbibliothek",
  "settings.section.voiceLibrary.desc": "Bekannte Stimmen",
  "settings.section.calendar": "Kalender",
  "settings.section.calendar.desc": "Google Kalender",
  "settings.section.claudeMcp": "Claude-Integration",
  "settings.section.claudeMcp.desc": "Claude Desktop / Code MCP",
  "settings.section.about": "Über",
  "settings.section.about.desc": "Version & Links",

  // Settings — language
  "settings.language.title": "Sprache",
  "settings.language.desc":
    "Wähle die Sprache der Scribe-Oberfläche und die der KI, die deine Besprechungen transkribiert und zusammenfasst.",
  "settings.language.display": "Anzeigesprache",
  "settings.language.display.desc":
    "Sprache, die in der Scribe-Oberfläche verwendet wird.",
  "settings.language.ai": "KI-Sprache",
  "settings.language.ai.desc":
    "Sprache für Transkription und Besprechungsnotizen. Auto-Erkennung erfasst die gesprochene Sprache automatisch.",
  "settings.language.auto": "Auto-Erkennung",
  "settings.language.placeholder": "Auswählen…",

  // Settings — appearance
  "settings.appearance.title": "Erscheinungsbild",
  "settings.appearance.desc":
    "Wähle ein Design oder lass Scribe deinem System folgen.",
  "settings.appearance.theme": "Design",
  "settings.appearance.theme.desc":
    "Wechsle zwischen hell und dunkel oder folge dem System. Drücke D zum Umschalten.",
  "settings.appearance.theme.system": "System",
  "settings.appearance.theme.light": "Hell",
  "settings.appearance.theme.dark": "Dunkel",
  "settings.appearance.accent": "Akzentfarbe",
  "settings.appearance.accent.desc":
    "Färbt Links, Buttons und Auswahl-Highlights in der gesamten App.",
  "settings.appearance.accent.indigo": "Indigo",
  "settings.appearance.accent.violet": "Violett",
  "settings.appearance.accent.blue": "Blau",
  "settings.appearance.accent.teal": "Petrol",
  "settings.appearance.accent.emerald": "Smaragd",
  "settings.appearance.accent.amber": "Bernstein",
  "settings.appearance.accent.rose": "Rosé",
  "settings.appearance.accent.pink": "Pink",
  "settings.appearance.fontUi": "Schriftart der Oberfläche",
  "settings.appearance.fontUi.desc":
    "Wird für Text und Überschriften der App verwendet.",
  "settings.appearance.fontMono": "Monospace-Schriftart",
  "settings.appearance.fontMono.desc":
    "Wird für Transkript-Zeitstempel und Code verwendet.",
  "settings.appearance.font.system": "System",
  "settings.appearance.font.serif": "Serif",
  "settings.appearance.font.custom": "Benutzerdefiniert…",
  "settings.appearance.font.customPlaceholder": "Schriftname (z. B. Menlo)",
  "settings.appearance.sidebarWidth": "Breite der Seitenleiste",
  "settings.appearance.sidebarWidth.desc":
    "Ziehe den Rand der Seitenleiste für feine Anpassung oder setze auf Standard zurück.",

  // Settings — transcription / WhisperX
  "settings.whisperx.title": "WhisperX-Engine",
  "settings.whisperx.desc":
    "WhisperX liefert deutlich bessere Qualität als der integrierte Transkriptor und erkennt Sprecher. Bei der ersten Einrichtung werden ca. 2 GB an Python-Abhängigkeiten lokal installiert.",
  "settings.whisperx.install": "Installieren",
  "settings.whisperx.reinstall": "Neu installieren",
  "settings.whisperx.retry": "Installation wiederholen",
  "settings.whisperx.status.installed": "Installiert und bereit",
  "settings.whisperx.status.installing":
    "Installation läuft… kann 3–5 Minuten dauern",
  "settings.whisperx.status.notInstalled":
    "Nicht installiert — Scribe verwendet den integrierten Transkriptor",
  "settings.whisperx.status.error": "Fehler",
  "settings.whisperx.status.checking": "Wird geprüft…",
  "settings.whisperx.preparing": "Wird vorbereitet…",

  // Settings — speakers / HF token
  "settings.hf.title": "HuggingFace-Zugriffstoken",
  "settings.hf.descPrefix":
    "Füge ein kostenloses HuggingFace-Token ein, um automatische Sprecherlabels zu aktivieren. Du musst zuerst die Bedingungen von",
  "settings.hf.descSuffix":
    "akzeptieren. Verschlüsselt im macOS-Schlüsselbund gespeichert.",
  "settings.hf.placeholder": "hf_xxxxxxxxxxxxxxxxxxxxxxxx",
  "settings.hf.getToken": "Token holen →",

  // Settings — voice library
  "settings.voice.title": "Bekannte Stimmen",
  "settings.voice.desc":
    "Stimmen, die Scribe bisher gelernt hat. Neue Besprechungen gleichen Sprecher mit dieser Liste ab — benenne einen Eintrag um oder entferne ihn, um ihn zurückzusetzen.",
  "settings.voice.empty":
    "Noch keine Stimmen gelernt. Markiere Sprecher in einer verarbeiteten Besprechung und sie erscheinen hier.",
  "settings.voice.meetingOne": "{count} Besprechung",
  "settings.voice.meetingMany": "{count} Besprechungen",
  "settings.voice.deleteEntry": "Aus Bibliothek entfernen",
  "settings.voice.deleteTitle": "Diese Stimme entfernen?",
  "settings.voice.deleteDesc":
    "Dieser Eintrag verlässt deine Stimmenbibliothek. Vergangene Besprechungen behalten den Namen; künftige erkennen diese Stimme nicht mehr automatisch.",
  "settings.voice.clickToRename": "Klicken zum Umbenennen",

  // Settings — calendar (OAuth)
  "settings.cal.creds.title": "OAuth-Anmeldedaten",
  "settings.cal.creds.desc":
    "Scribe benötigt einen persönlichen Google-OAuth-Client für den Kalenderzugriff. Einmalige Einrichtung.",
  "settings.cal.creds.checking": "Wird geprüft…",
  "settings.cal.creds.notConfigured": "Noch nicht konfiguriert.",
  "settings.cal.creds.showMe": "Zeig mir wie",
  "settings.cal.creds.clear": "Anmeldedaten löschen",
  "settings.cal.accounts.title": "Verbundene Konten",
  "settings.cal.accounts.desc":
    "Melde dich bei einem oder mehreren Google-Konten an, um deren Kalender zu importieren.",
  "settings.cal.accounts.needCreds":
    "Füge oben OAuth-Anmeldedaten hinzu, bevor du ein Konto verbindest.",
  "settings.cal.accounts.connect": "Google Kalender verbinden",
  "settings.cal.accounts.waiting": "Warte auf Browser…",
  "settings.cal.accounts.addAnother": "Weiteres Konto hinzufügen",
  "settings.cal.accounts.syncNow": "Jetzt synchronisieren",
  "settings.cal.accounts.disconnect": "Trennen",
  "settings.cal.accounts.disconnectTitle": "Dieses Konto trennen?",
  "settings.cal.accounts.disconnectDesc":
    "Bereits verknüpfte Aufnahmen bleiben. Neue Termine dieses Kontos werden nicht mehr synchronisiert.",
  "settings.cal.accounts.connectedOn": "verbunden am {date}",
  "settings.cal.wizard.title": "Google Kalender einrichten",
  "settings.cal.wizard.clientId": "Client-ID",
  "settings.cal.wizard.clientSecret": "Client-Secret",
  "settings.cal.wizard.save": "Anmeldedaten speichern",

  // Settings — about
  "settings.about.title": "Scribe",
  "settings.about.desc": "Lokal zuerst — Besprechungsaufnahme.",
  "settings.about.version": "Version",
  "settings.about.version.desc": "Aktuelle Version auf diesem Gerät.",
  "settings.about.storage": "Speicher",
  "settings.about.storage.desc":
    "Aufnahmen, Transkripte und die Stimmenbibliothek werden lokal unter ~/Library/Application Support/Scribe gespeichert.",
  "settings.about.diar": "Diarisations-Modell",
  "settings.about.diar.desc":
    "pyannote/speaker-diarization-3.1 über HuggingFace.",
  "settings.about.diar.link": "Modellseite →",
  "settings.about.engine": "Transkriptions-Engine",
  "settings.about.engine.desc": "WhisperX — m-bain/whisperX.",
  "settings.about.engine.link": "GitHub →",

  // Settings — KI-Anbieter
  "settings.ai.title": "Notiz-Engine",
  "settings.ai.desc":
    "Lege fest, wie Scribe Meeting-Notizen schreibt. „Eingebaut“ läuft komplett lokal; Ollama und OpenAI-kompatibel erlauben dir, jedes lokale oder entfernte Modell zu nutzen, das deren API folgt.",
  "settings.ai.provider": "Anbieter",
  "settings.ai.provider.desc": "Aktive Engine zur Notizgenerierung.",
  "settings.ai.provider.bundled": "Eingebaut (lokal)",
  "settings.ai.provider.ollama": "Ollama",
  "settings.ai.provider.openai": "OpenAI-kompatibel",
  "settings.ai.provider.anthropic": "Anthropic-API (Claude mit API-Key)",
  "settings.ai.provider.claudeCode": "Claude Code (Abo)",
  "settings.ai.bundled.model": "Modell",
  "settings.ai.bundled.model.desc":
    "Wird unter ~/Library/Application Support/Scribe/models gespeichert. Modelle, die größer als das Standard-Gemma 3 (4B) sind, müssen vor der Nutzung explizit heruntergeladen werden.",
  "settings.ai.bundled.downloaded": "Heruntergeladen",
  "settings.ai.bundled.download": "Herunterladen",
  "settings.ai.bundled.downloading": "Herunterladen…",
  "settings.ai.bundled.selected": "Ausgewählt",
  "settings.ai.bundled.select": "Auswählen",
  "settings.ai.bundled.notDownloadedHint":
    "Lade dieses Modell herunter, bevor du damit Notizen generierst.",
  "settings.ai.bundled.downloadFailed": "Download fehlgeschlagen",
  "settings.ai.bundled.delete": "Entfernen",
  "settings.ai.bundled.deleteConfirm": "Bestätigen",
  "settings.ai.ollama.endpoint": "Endpunkt",
  "settings.ai.ollama.endpoint.desc":
    "URL deines Ollama-Servers. Standardmäßig die lokale App auf Port 11434.",
  "settings.ai.ollama.model": "Modell",
  "settings.ai.ollama.model.placeholder": "Modell wählen",
  "settings.ai.ollama.noModels":
    "Keine Modelle gefunden. `ollama pull <modell>` ausführen und aktualisieren.",
  "settings.ai.openai.endpoint": "Endpunkt",
  "settings.ai.openai.endpoint.desc":
    "OpenAI-kompatible Basis-URL. Funktioniert mit OpenAI, LM Studio, vLLM, OpenRouter, Together, Groq usw.",
  "settings.ai.openai.apiKey": "API-Schlüssel",
  "settings.ai.openai.apiKey.desc":
    "Lokal gespeichert und über den System-Schlüsselbund verschlüsselt.",
  "settings.ai.openai.apiKey.placeholder": "sk-…",
  "settings.ai.openai.apiKey.saved": "Schlüssel gespeichert",
  "settings.ai.openai.model": "Modell",
  "settings.ai.openai.model.placeholder": "Modell wählen",
  "settings.ai.openai.noModels":
    "Keine Modelle erhalten. Endpunkt und Schlüssel prüfen und aktualisieren.",
  "settings.ai.anthropic.endpoint": "Endpunkt",
  "settings.ai.anthropic.endpoint.desc":
    "Anthropic API Basis-URL. Standardmäßig api.anthropic.com.",
  "settings.ai.anthropic.apiKey": "API-Schlüssel",
  "settings.ai.anthropic.apiKey.desc":
    "Lokal gespeichert und über den System-Schlüsselbund verschlüsselt. Schlüssel anfordern: console.anthropic.com.",
  "settings.ai.anthropic.apiKey.placeholder": "sk-ant-…",
  "settings.ai.anthropic.apiKey.saved": "Schlüssel gespeichert",
  "settings.ai.anthropic.model": "Modell",
  "settings.ai.anthropic.model.placeholder": "Modell wählen",
  "settings.ai.anthropic.noModels":
    "Keine Modelle erhalten. Schlüssel prüfen und aktualisieren.",
  "settings.ai.kb.label": "Knowledge-Base-Ordner",
  "settings.ai.kb.desc":
    "Absoluter Pfad zu einem Ordner, den der Agent beim Erzeugen der Notizen lesen darf. Der Agent sucht und liest Dateien bedarfsweise via MCP. Leer lassen für eine einfache Single-Shot-Zusammenfassung.",
  "settings.ai.kb.placeholder": "/Users/du/Notizen",
  "settings.ai.kb.check": "Ordner prüfen",
  "settings.ai.kb.check.desc":
    "Prüft, ob der Ordner existiert, lesbar ist und Dateien enthält. Kostenlos — kein LLM-Aufruf.",
  "settings.ai.kb.check.button": "Prüfen",
  "settings.ai.kb.check.ok": "Sieht gut aus",
  "settings.ai.kb.check.missing": "Pfad nicht gefunden",
  "settings.ai.kb.check.notDir": "Pfad ist kein Ordner",
  "settings.ai.kb.check.noAccess": "Nicht lesbar",
  "settings.ai.kb.check.empty": "Keine lesbaren Dateien",
  "settings.ai.kb.check.error": "Prüfung fehlgeschlagen",
  "settings.ai.kb.check.sample": "z.B.",
  "settings.ai.claudeCode.status": "CLI-Status",
  "settings.ai.claudeCode.statusDesc":
    "Führt `claude -p` über die lokale Claude-Code-CLI mit deinem Pro-/Max-Abo aus. Kein API-Key, keine tokenweise Abrechnung — der Verbrauch zählt gegen das Abo-Kontingent (bis 15. Juni 2026; danach gegen einen separaten Pool von 100 $/Monat zu API-Preisen).",
  "settings.ai.claudeCode.notInstalled":
    "claude-CLI nicht im PATH gefunden. Installiere Claude Code zuerst.",
  "settings.ai.claudeCode.notAuthed":
    "claude-CLI gefunden, aber nicht angemeldet. Führe `claude login` im Terminal aus.",
  "settings.ai.claudeCode.ready": "Bereit",
  "settings.ai.claudeCode.model": "Modell",
  "settings.ai.claudeCode.askOption": "Jedes Mal fragen",
  "settings.ai.claudeCode.askDesc":
    "Vor jeder Generierung ein Modell auswählen. Praktisch, um Haiku für Stand-ups und Opus für strategische Meetings zu verwenden, ohne die Einstellungen jedes Mal zu ändern.",
  "settings.ai.claudeCode.kbDesc":
    "Absoluter Pfad zu einem Ordner, den die CLI lesen darf. Wird als `--add-dir` übergeben. Leer lassen für keinen zusätzlichen Dateisystemzugriff.",
  "settings.ai.claudeCode.usage.title": "Nutzung",
  "settings.ai.claudeCode.usage.desc":
    "Summen aller Meetings, die mit Claude Code verarbeitet wurden. Die Kosten entsprechen den von der CLI gemeldeten API-Äquivalenzwerten — unter deinem aktiven Max-Abo werden sie absorbiert; nach dem 15. Juni 2026 belasten sie den separaten programmatischen Kredit-Pool.",
  "settings.ai.claudeCode.usage.emptyDesc":
    "Bisher wurde noch keine Sitzung mit diesem Anbieter verarbeitet.",
  "settings.ai.test": "Verbindung testen",
  "settings.ai.test.ok": "Verbunden",
  "settings.ai.test.fail": "Verbindung fehlgeschlagen",
  "settings.ai.save": "Speichern",
  "settings.ai.saved": "Gespeichert",
  "settings.ai.clear": "Löschen",

  // Settings — Notiz-Vorlagen
  "settings.templates.title": "Notiz-Vorlagen",
  "settings.templates.desc":
    "Eine Vorlage ist die Persona und der Fokus, mit denen Scribe Notizen schreibt. Das Ausgabe-Schema (Zusammenfassung, Abschnitte, Entscheidungen, Aufgaben, Tags) ist fest verdrahtet — du bearbeitest, wie das LLM gebrieft wird, nicht was es ausgibt.",
  "settings.templates.default": "Standard-Vorlage",
  "settings.templates.default.desc":
    "Wird für jedes Meeting verwendet, das keine eigene Vorlage hat.",
  "settings.templates.builtin": "Eingebaut",
  "settings.templates.custom": "Eigene",
  "settings.templates.edit": "Bearbeiten",
  "settings.templates.save": "Speichern",
  "settings.templates.cancel": "Abbrechen",
  "settings.templates.reset": "Zurücksetzen",
  "settings.templates.delete": "Löschen",
  "settings.templates.new": "Neue Vorlage",
  "settings.templates.name": "Name",
  "settings.templates.name.placeholder": "z. B. Kunden-Onboarding",
  "settings.templates.instructions": "Anweisungen",
  "settings.templates.instructions.placeholder":
    "Beschreibe den Meeting-Typ und worauf das LLM achten soll. Beispiel: „Du fasst ein 1:1 zusammen. Sei ehrlich zu Bedenken. Aktionspunkte brauchen einen klaren Owner.\"",
  "settings.templates.create": "Vorlage erstellen",
  "settings.templates.confirmDelete":
    "Diese Vorlage löschen? Meetings, die sie nutzen, fallen auf die Standard-Vorlage zurück.",
  "settings.templates.useGlobal": "Standard verwenden",

  // Settings — Claude-Integration (MCP-Server)
  "settings.mcp.title": "Claude Desktop & Code Integration",
  "settings.mcp.desc":
    "Stelle deine Scribe-Meetings Claude über das Model Context Protocol bereit. Claude kann sie auflisten, lesen, durchsuchen und zusammenfassen — kombiniert mit allem, was es sonst kennt (dein Obsidian-Vault, das Web, Code, usw.).",
  "settings.mcp.status": "Server",
  "settings.mcp.status.desc":
    "Gibt an, ob das MCP-Server-Skript auf der Festplatte verfügbar ist.",
  "settings.mcp.status.ready": "Bereit",
  "settings.mcp.status.notBuilt":
    "Noch nicht gebaut. In dev: `npm run build:mcp` ausführen und neu prüfen klicken.",
  "settings.mcp.recheck": "Neu prüfen",
  "settings.mcp.scriptPath": "Server-Pfad",
  "settings.mcp.scriptPath.desc":
    "Absoluter Pfad zum MCP-Server. In deiner Claude-Konfiguration verwenden.",
  "settings.mcp.snippet": "Konfigurations-Snippet",
  "settings.mcp.snippet.desc":
    "Füge dies in claude_desktop_config.json unter \"mcpServers\" ein.",
  "settings.mcp.snippet.copy": "Kopieren",
  "settings.mcp.snippet.copied": "Kopiert",
  "settings.mcp.claudeConfig": "Claude Desktop Konfig",
  "settings.mcp.claudeConfig.desc":
    "Öffne den Ordner mit claude_desktop_config.json zum Bearbeiten.",
  "settings.mcp.claudeConfig.reveal": "Im Finder zeigen",
  "settings.mcp.allowWrites": "Claude darf bearbeiten",
  "settings.mcp.allowWrites.desc":
    "Aktiviert: Claude darf Zusammenfassungen umschreiben, Aufgaben hinzufügen/abhaken, Meetings neu taggen, Sprecher umbenennen und Titel bearbeiten. Jede Änderung wird in {userData}/logs/mcp.log protokolliert. Standardmäßig aus.",
  "settings.mcp.allowWrites.on": "Schreiben aktiviert",
  "settings.mcp.allowWrites.off": "Nur Lesen",
  "settings.mcp.nodeRequirement":
    "Der MCP-Server nutzt Nodes eingebautes SQLite-Modul — Node 22 oder neuer erforderlich. Claude Desktop für macOS bringt ein aktuelles Node mit; bei Startfehlern prüfe, dass `node --version` 22.x meldet.",

  // Settings — Claude skill
  "settings.mcp.skill.title": "Claude-Skill",
  "settings.mcp.skill.desc":
    "Installiert das `scribe-mcp`-Skill global für Claude Desktop und Claude Code. Es bringt Claude bei, wann es Scribes MCP-Tools nutzen soll — Meetings auflisten, Zusammenfassungen umschreiben, Aufgaben im Batch hinzufügen — und wie es das mit deinem Symphonics-Vokabular kombiniert.",
  "settings.mcp.skill.status": "Status",
  "settings.mcp.skill.status.desc":
    "Zeigt, ob das mitgelieferte Skill mit dem unter ~/.claude/skills/ installierten übereinstimmt.",
  "settings.mcp.skill.status.installed": "Installiert (aktuell)",
  "settings.mcp.skill.status.outdated":
    "Der Scribe-Teil ist veraltet. Aktualisieren erneuert ihn und behält deine Ergänzungen.",
  "settings.mcp.skill.userSection":
    "Persönlicher Abschnitt erkannt: bleibt beim Aktualisieren erhalten und wird bei der Aktualitätsprüfung ignoriert.",
  "settings.mcp.skill.preserved":
    "Aktualisiert. Dein persönlicher Abschnitt wurde beibehalten.",
  "settings.mcp.skill.backedUp":
    "Aktualisiert. Die vorherige Datei hatte keine Markierung für den persönlichen Abschnitt und wurde gesichert nach:",
  "settings.mcp.skill.status.notInstalled": "Nicht installiert",
  "settings.mcp.skill.status.missing":
    "Mitgeliefertes Skill fehlt (dev: prüfe, dass mcp-server/skills/scribe-mcp/SKILL.md existiert).",
  "settings.mcp.skill.path": "Installationspfad",
  "settings.mcp.skill.path.desc":
    "Standard-Global-Pfad, den Claude beim Start liest.",
  "settings.mcp.skill.actions": "Aktionen",
  "settings.mcp.skill.actions.desc":
    "Installieren kopiert das mitgelieferte Skill nach ~/.claude/skills/. Dein persönlicher Abschnitt (unter der Markierung) bleibt beim Aktualisieren erhalten. Claude Desktop neu starten, damit Änderungen wirksam werden.",
  "settings.mcp.skill.install": "Skill installieren",
  "settings.mcp.skill.update": "Aktualisieren",
  "settings.mcp.skill.upToDate": "Aktuell",
  "settings.mcp.skill.uninstall": "Deinstallieren",
  "settings.mcp.skill.reveal": "Im Finder zeigen",
  "settings.mcp.skill.bundledMissing":
    "Installation nicht möglich: mitgeliefertes Skill nicht gefunden. App neu bauen und erneut versuchen.",

  // Command palette
  "palette.placeholder": "Meetings durchsuchen, Befehle ausführen…",
  "palette.searching": "Suche…",
  "palette.noResults": "Keine Treffer.",
  "palette.openHint": "Suche und Befehle",
  "palette.group.actions": "Aktionen",
  "palette.group.navigation": "Navigation",
  "palette.group.meetings": "Meetings",
  "palette.group.recent": "Zuletzt geöffnet",
  "palette.group.people": "Personen",
  "palette.group.tags": "Tags",
  "palette.group.folders": "Ordner",
  "palette.group.preferences": "Einstellungen",
  "palette.nav.goTo": "Zu {target}",
  "palette.tab.switch": "Tab: {tab}",
  "palette.action.processMeeting": "Aktuelles Meeting verarbeiten",
  "palette.action.clearTagFilter": "Tag-Filter zurücksetzen",
  "palette.action.find": "Auf der Seite suchen",
  "palette.matchedIn.title": "Titel",
  "palette.matchedIn.transcript": "Transkript",
  "palette.matchedIn.tag": "Tag",
  "palette.matchedIn.summary": "Zusammenfassung",
  "palette.theme.light": "Design: Hell",
  "palette.theme.dark": "Design: Dunkel",
  "palette.theme.system": "Design: System",
  "palette.lang.en": "Sprache: English",
  "palette.lang.fr": "Sprache: Français",
  "palette.lang.es": "Sprache: Español",
  "palette.lang.de": "Sprache: Deutsch",

  // Obere Leiste
  "topbar.refresh": "Seite aktualisieren",

  // Auf der Seite suchen (Cmd+F)
  "find.placeholder": "Auf der Seite suchen",
  "find.matches": "{current} von {total}",
  "find.noMatches": "Keine Treffer",
  "find.previous": "Vorheriger Treffer",
  "find.next": "Nächster Treffer",
  "find.matchCase": "Groß-/Kleinschreibung",
  "find.close": "Suche schließen",

  // Pipeline badges (meeting header)
  "pipeline.transcribe": "Transkription",
  "pipeline.align": "Ausrichtung",
  "pipeline.diarize": "Diarisierung",
  "pipeline.notes": "Notizen",

  // Usage badges (meeting header)
  "usage.kb": "KB",
  "usage.calls": "{count} Aufrufe",
  "usage.sub": "Abo",
  "usage.tip.model": "Modell: {value}",
  "usage.tip.input": "Eingabe: {value}",
  "usage.tip.output": "Ausgabe: {value}",
  "usage.tip.cacheRead": "Cache-Lesen: {value}",
  "usage.tip.cacheWrite": "Cache-Schreiben: {value}",
  "usage.tip.cost": "Kosten: {value}",
  "usage.tip.costSub": " (zu API-Tarifen; vom Abo abgedeckt)",
  "usage.tip.turns": "Durchläufe: {value}",
  "usage.tip.duration": "Dauer: {value}s",
  "usage.tip.session": "Sitzung: {value}",

  // Claude Code usage stats (settings)
  "settings.ai.claudeCode.usage.meetings": "Besprechungen",
  "settings.ai.claudeCode.usage.tokens": "Tokens ein / aus",
  "settings.ai.claudeCode.usage.cacheRead": "Cache-Lesen",
  "settings.ai.claudeCode.usage.cost": "Kosten (API-Äquiv.)",
  "settings.ai.claudeCode.usage.avg": "Ø / Besprechung",
  "settings.ai.claudeCode.usage.totalTime": "Gesamtzeit",
  "settings.ai.claudeCode.usage.lastRun": "Letzter Lauf",

  // Relative time
  "time.justNow": "gerade eben",
  "time.minAgo": "vor {value} Min.",
  "time.hoursAgo": "vor {value} Std.",
  "time.daysAgoShort": "vor {value} T.",
  "time.daysAgo": "vor {count} Tagen",

  // Common additions
  "common.email": "E-Mail",
  "common.plusMore": "+{count} weitere",

  // People view
  "people.heardInOne": "In 1 Besprechung gehört",
  "people.heardInMany": "In {count} Besprechungen gehört",
  "people.lastOn": "zuletzt am {date}",
  "people.delete.title": "Diese Stimme entfernen?",
  "people.delete.body":
    "„{name}“ wird aus deiner Stimmenbibliothek entfernt. Vergangene Besprechungen behalten den Sprechernamen, aber künftige Besprechungen erkennen diese Stimme nicht mehr automatisch. Du kannst den Eintrag durch erneutes Markieren neu erstellen.",

  // Processing — steps
  "processing.step.mixAudio": "Audio mischen",
  "processing.step.alignWords": "Wörter ausrichten",
  "processing.step.identifySpeakers": "Sprecher erkennen",

  // Processing — stages
  "processing.stage.starting": "Vorbereitung",
  "processing.stage.mixing": "Audiospuren werden gemischt",
  "processing.stage.loadingRuntime": "Laufzeit wird geladen",
  "processing.stage.loadingAudio": "Audio wird gelesen",
  "processing.stage.loadingModel": "Whisper-Modell wird geladen",
  "processing.stage.transcribing": "Sprache wird transkribiert",
  "processing.stage.transcribed": "Transkription bereit",
  "processing.stage.loadingAlign": "Aligner wird geladen",
  "processing.stage.aligning": "Zeitstempel werden ausgerichtet",
  "processing.stage.alignFailed": "Ausrichtung nicht verfügbar",
  "processing.stage.loadingDiarize": "Diarizer wird geladen",
  "processing.stage.diarizeLoaded": "Diarizer bereit",
  "processing.stage.diarizing": "Sprecher werden erkannt",
  "processing.stage.diarizeSegments": "Segmente werden zugeordnet",
  "processing.stage.diarizeAssigned": "Sprecher werden zugewiesen",
  "processing.stage.diarizeFailed": "Diarisierung nicht verfügbar",
  "processing.stage.diarizeSkipped": "Diarisierung übersprungen",
  "processing.stage.serializing": "Transkript wird finalisiert",
  "processing.stage.model": "Sprachmodell wird vorbereitet",
  "processing.stage.loading": "Sprachmodell wird geladen",
  "processing.stage.generating": "Zusammenfassung & Aufgaben werden geschrieben",
  "processing.stage.agent": "Wissensdatenbank wird gelesen",
  "processing.stage.writing": "Notizen werden gespeichert",

  // Processing — headlines
  "processing.headline.generate": "Notizen werden erstellt",
  "processing.headline.transcribe": "Transkript wird verarbeitet",
  "processing.headline.diarize": "Erneute Diarisierung",
  "processing.headline.default": "Besprechung wird verarbeitet",

  // Tree (folders / meetings)
  "tree.autoTagTooltip": "Auto-Tag: #{name}",
  "tree.autoTagAria": "Auto-Tag: {name}",
  "tree.newFolderInside": "Neuer Ordner darin",
  "tree.startMeetingInFolder": "Besprechung im Ordner starten",
  "tree.deleteFolder": "Ordner löschen",
  "tree.deleteFolderConfirm":
    "„{name}“ löschen? Besprechungen darin rücken eine Ebene nach oben.",
  "tree.pinToTop": "Oben anheften",
  "tree.unpin": "Lösen",
  "tree.deleteMeetingConfirm":
    "„{name}“ löschen? Aufnahme, Transkript und Notizen werden dauerhaft entfernt.",
  "tree.deleteMeeting": "Besprechung löschen",
  "tree.changeAutoTag": "Auto-Tag ändern",
  "tree.setAutoTag": "Auto-Tag festlegen",
  "tree.autoTag": "Auto-Tag",
  "tree.autoMoveHeading": "Auto-verschieben bei Tag",
  "tree.noTagsYet": "Noch keine Tags — erstelle zuerst einen aus einer Besprechung.",

  // Pinned section
  "pinned.heading": "Angeheftet",

  // Calendar events
  "event.join": "Beitreten",

  // Linked event row
  "linkedEvent.unlink": "Verknüpfung lösen",
  "linkedEvent.notLinked": "Nicht mit einem Kalenderereignis verknüpft",
  "linkedEvent.autoLink": "Auto-verknüpfen",
  "linkedEvent.dialogTitle": "Diese Besprechung mit einem Kalenderereignis verknüpfen",
  "linkedEvent.dialogDesc":
    "Ereignisse innerhalb von ±24 Stunden der Aufnahme, nach Übereinstimmung sortiert. Die Bewertung berücksichtigt Überlappung und Titelähnlichkeit.",
  "linkedEvent.filterPlaceholder": "Nach Titel filtern…",
  "linkedEvent.loadingCandidates": "Kandidaten werden geladen…",
  "linkedEvent.noCandidates":
    "Keine passenden Ereignisse in der Nähe. Synchronisiere deinen Kalender.",

  // Tags section
  "tagsSection.show": "Tags anzeigen",
  "tagsSection.hide": "Tags ausblenden",
  "tagsSection.newTag": "Neuer Tag",
  "tagsSection.clear": "löschen",
  "tagsSection.auto": "auto",
  "tagsSection.deleteTag": "Tag {name} löschen",
  "tagsSection.tagNamePlaceholder": "Tag-Name",

  // Tag chips
  "tagChips.placeholder": "Tag-Name…",
  "tagChips.autoFromNotes": "Auto-Tag aus Notizen",
  "tagChips.remove": "Tag {name} entfernen",

  // Speakers chip
  "speakersChip.manage": "Sprecher verwalten",
  "speakersChip.needReviewOne": "1 Sprecher zu prüfen",
  "speakersChip.needReviewMany": "{count} Sprecher zu prüfen",
  "speakersChip.linked": "{linked} von {total} mit deiner Stimmenbibliothek verknüpft",

  // Sample audio
  "sample.failed": "Beispiel konnte nicht geladen werden",
  "sample.unavailable": "Kein Beispiel verfügbar",
  "sample.play": "Beispiel abspielen",

  // Model prompt dialog
  "modelPrompt.title": "Modell auswählen",
  "modelPrompt.desc":
    "Claude (Abo) fragt jedes Mal nach. Wähle ein Modell für: {intent}.",

  // Meeting notification (floating window)
  "notification.startsInMin": "Beginnt in {count} Min.",
  "notification.startsInOne": "Beginnt in 1 Min.",
  "notification.startingNow": "Beginnt jetzt",
  "notification.startedAgo": "Vor {count} Min. begonnen",
  "notification.join": "Besprechung beitreten",

  // Sidebar
  "sidebar.resize": "Seitenleiste anpassen (aktuell {width}px, min {min}, max {max})",

  // Transcript view
  "transcript.speaker": "Sprecher",
  "transcript.jumpTo": "Zu diesem Moment springen",
  "transcript.empty.title": "Noch kein Transkript",
  "transcript.empty.body":
    "Führe die komplette Pipeline aus (Transkription + Notizen) oder transkribiere nur und schreibe die Notizen anderswo — z. B. via Claude Code über MCP.",

  // Calendar view
  "calendar.empty.list":
    "Keine Ereignisse in den nächsten 60 Tagen. Klicke auf das Aktualisieren-Symbol zum Synchronisieren.",
  "calendar.past": "Vergangen",
  "calendar.eventOne": "{count} Ereignis",
  "calendar.eventMany": "{count} Ereignisse",
  "calendar.empty.upcoming": "Nichts geplant. Vergangene Ereignisse stehen oben.",
  "calendar.recordedTooltip": "Eine Scribe-Aufnahme ist mit diesem Ereignis verknüpft",

  // Event popover
  "eventPopover.openNotes": "Notizen öffnen",
  "eventPopover.noRecording": "Noch keine Scribe-Aufnahme verknüpft.",

  // Anthropic model picker
  "modelPicker.required": "· erforderlich",
  "modelPicker.placeholder": "Modell auswählen…",
  "modelPicker.default": "{model} (Standard)",

  // Voice tagging panel
  "voicePanel.unknownOne": "{count} unbekannte Stimme",
  "voicePanel.unknownMany": "{count} unbekannte Stimmen",
  "voicePanel.close": "Sprecher-Panel schließen",
  "voicePanel.empty.noSpeakers":
    "Keine Sprecher erkannt. Führe oben die Diarisierung aus — wenn du die Anzahl kennst, gib sie zuerst an, für ein viel saubereres Ergebnis.",
  "voicePanel.empty.noToken":
    "Füge in den Einstellungen ein Hugging-Face-Token hinzu und diarisiere diese Besprechung erneut, um Stimmen zu benennen.",
  "voicePanel.searchPlaceholder": "Kontakt suchen oder erstellen…",
  "voicePanel.assign": "{name} zuweisen",
  "voicePanel.audioOnly": "Nur Audiobeispiel",
  "voicePanel.hidePicker": "Auswahl ausblenden",
  "voicePanel.reassign": "Kontakt neu zuweisen",
  "voicePanel.createContact": "„{query}“ hinzufügen",
  "voicePanel.notSpeaker": "Kein echter Sprecher",
  "voicePanel.noMatch": "Kein Treffer für „{query}“.",
  "voicePanel.invitees": "Eingeladene",
  "voicePanel.recentContacts": "Letzte Kontakte",

  // Meeting header — flows & speaker prompt dialog
  "header.flow.transcribe.title": "Besprechung transkribieren",
  "header.flow.transcribe.desc":
    "Pyannote zählt Sprecher oft zu hoch — gib die genaue Anzahl an, um das Clustering festzulegen. Leer lassen zum Schätzen.",
  "header.flow.rediarize.title": "Sprecher neu diarisieren",
  "header.flow.rediarize.desc":
    "Wie viele Personen haben gesprochen? Ein erneuter Lauf mit genauer Anzahl ergibt ein deutlich saubereres Clustering. Leer lassen, damit pyannote schätzt.",
  "header.flow.rediarize.confirm": "Neu diarisieren",
  "header.flow.process.desc":
    "Transkribieren + diarisieren + zusammenfassen. Die genaue Sprecheranzahl vorab gibt pyannote ein viel präziseres Clustering als die Standardschätzung. Leer lassen zum Schätzen.",
  "header.flow.process.confirm": "Verarbeiten",
  "header.dialog.template": "Notizvorlage",
  "header.dialog.templateDefault": "Standard",
  "header.dialog.speakerCount": "Anzahl der Sprecher",
  "header.dialog.detected": "· aktuell erkannt: {count}",
  "header.dialog.speakerCountPlaceholder": "z. B. 9",

  // Tasks count
  "tasks.countOne": "{count} Aufgabe",
  "tasks.countMany": "{count} Aufgaben",
};
