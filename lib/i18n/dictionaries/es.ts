import type { Dictionary } from "../dictionaries";

export const es: Dictionary = {
  // Common
  "common.loading": "Cargando…",
  "common.save": "Guardar",
  "common.saving": "Guardando…",
  "common.cancel": "Cancelar",
  "common.delete": "Eliminar",
  "common.rename": "Renombrar",
  "common.dismiss": "Cerrar",
  "common.retry": "Reintentar",
  "common.reset": "Restablecer",
  "common.clear": "Borrar",
  "common.connect": "Conectar",
  "common.disconnect": "Desconectar",
  "common.connected": "Conectado",
  "common.add": "Añadir",
  "common.edit": "Editar",
  "common.close": "Cerrar",
  "common.error": "Algo salió mal",
  "common.copyFailed": "No se pudo copiar al portapapeles",

  // Sidebar / nav
  "nav.meetings": "Reuniones",
  "nav.tasks": "Tareas",
  "nav.calendar": "Calendario",
  "nav.people": "Personas",
  "nav.settings": "Ajustes",
  "nav.newFolder": "Nueva carpeta",
  "nav.openSettings": "Abrir ajustes",

  // Top bar / recording
  "recording.start": "Iniciar Scribe",
  "recording.status": "Grabando",
  "recording.startEvent": 'Iniciar "{title}"',
  "recording.startingEllipsis": "Iniciando…",
  "recording.stop": "Detener",
  "recording.stoppingEllipsis": "Deteniendo…",
  "recording.linkedTooltip":
    'Vinculado a "{title}" — empezó hace {minutes} min',
  "recording.levelMic": "Mic",
  "recording.levelSys": "Sis",
  "recording.micSource": "Micrófono",
  "recording.micDefault": "Predeterminado del sistema",
  "recording.micUnknown": "Micrófono",

  // App shell toasts
  "toast.errorTitle": "Algo salió mal",
  "toast.dismissError": "Cerrar error",
  "toast.autoLinkedOne": "1 hablante vinculado automáticamente",
  "toast.autoLinkedMany": "{count} hablantes vinculados automáticamente",
  "toast.needsReviewSuffix": " · {count} por revisar",
  "toast.needsReviewSuffixOne": " · 1 por revisar",
  "toast.autoLinkedDetail": "{names} de tu biblioteca de voces.",
  "toast.reviewInPeople": "Revisar en Personas",
  "toast.systemAudioTitle": "Audio del sistema no capturado",
  "toast.systemAudioBody": "Tu micrófono se está grabando, pero los demás participantes no. Concede a Scribe el permiso de Grabación de pantalla y vuelve a iniciar la grabación.",
  "toast.openScreenSettings": "Abrir ajustes de Grabación de pantalla",

  // Lazy view fallback
  "view.loading": "Cargando…",

  // Meeting empty state
  "meeting.empty.title": "Ninguna reunión seleccionada",
  "meeting.empty.hint":
    "Inicia una nueva grabación desde la barra lateral, o elige una de la lista.",
  "meeting.tab.summary": "Resumen",
  "meeting.tab.transcript": "Transcripción",
  "meeting.tab.tasks": "Tareas",
  "meeting.tab.bullets": "Puntos clave",
  "meeting.tab.scratchpad": "Bloc de notas",
  "player.play": "Reproducir",
  "player.pause": "Pausa",
  "player.seek": "Posición",
  "player.mute": "Silenciar",
  "player.unmute": "Activar sonido",
  "player.volume": "Volumen",

  // Summary view
  "summary.copy": "Copiar el resumen completo",
  "summary.copied": "¡Copiado!",
  "summary.exec": "Resumen ejecutivo",
  "summary.overview": "Visión general",
  "summary.inDepth": "En detalle",
  "summary.topicOne": "{count} tema",
  "summary.topicMany": "{count} temas",
  "summary.decisions": "Decisiones",
  "summary.empty.title": "Aún no hay resumen",
  "summary.empty.generate":
    "Genera notas para producir un resumen detallado en varias secciones.",
  "summary.empty.process":
    "Procesa la grabación para transcribir y producir las notas en un solo paso.",
  "summary.processing": "Procesando…",
  "summary.generateNotes": "Generar notas",
  "summary.processMeeting": "Procesar reunión",

  // Bullet points (Key points tab)
  "bullets.copy": "Copiar puntos clave",
  "bullets.copied": "¡Copiado!",
  "bullets.empty.title": "Aún no hay puntos clave",
  "bullets.empty.generate":
    "Procesa la grabación: los puntos clave se generan junto con las notas.",
  "bullets.empty.regenerate":
    "Vuelve a generar las notas para producir los puntos clave de esta reunión.",

  // Scratch pad
  "scratchpad.placeholder":
    "Anota lo que quieras: notas, seguimientos, enlaces. Se guarda automáticamente.",
  "scratchpad.saving": "Guardando…",
  "scratchpad.saved": "Guardado",

  // Notes / action items (Tasks tab)
  "notes.actionItems": "Acciones a realizar",
  "notes.empty.title": "Aún no hay tareas",
  "notes.empty.generate":
    "Genera notas para extraer acciones por orador.",
  "notes.empty.process":
    "Procesa la grabación para transcribir y extraer acciones.",
  "notes.unassigned": "Sin asignar",
  "notes.markDone": "Marcar como hecho",
  "notes.markNotDone": "Marcar como no hecho",

  // Meeting header
  "header.time": "Hora",
  "header.speakers": "Hablantes",
  "header.status": "Estado",
  "header.event": "Evento",
  "header.tags": "Etiquetas",
  "header.pipeline": "Pipeline",
  "header.review": "Revisar",
  "header.review.oneNeeded": "1 hablante por confirmar",
  "header.review.manyNeeded": "{count} hablantes por confirmar",
  "header.tagVoices": "Etiquetar voces",
  "header.hide": "Ocultar",
  "header.show": "Mostrar",
  "header.reviewVerb": "Revisar",
  "header.hidePipeline": "Ocultar detalles del pipeline",
  "header.meetingActions": "Acciones de la reunión",
  "header.reprocess": "Reprocesar reunión",
  "header.process": "Procesar reunión",
  "header.retranscribe": "Solo re-transcribir",
  "header.transcribeOnly": "Solo transcribir",
  "header.rediarizeOnly": "Solo re-diarizar",
  "header.regenerate": "Solo regenerar notas",
  "header.generateOnly": "Solo generar notas",
  "header.chooseEvent": "Elegir evento…",
  "header.addTag": "Añadir etiqueta",
  "header.titleLabel": "Título de la reunión",
  "header.deleteConfirmTitle": "¿Eliminar la reunión?",
  "header.deleteConfirmDesc":
    "Esto elimina permanentemente la grabación, la transcripción y las notas.",

  // Meeting status
  "status.recording": "Grabando",
  "status.recorded": "Grabado",
  "status.transcribing": "Transcribiendo",
  "status.transcribed": "Transcrito",
  "status.diarized": "Hablantes identificados",
  "status.done": "Listo",
  "status.error": "Error",

  // People
  "people.title": "Personas",
  "people.countOne": "1 voz",
  "people.countMany": "{count} voces",
  "people.empty.title": "Aún no hay voces",
  "people.openLastMeeting": "Abrir última reunión",
  "people.you": "Tú",
  "people.markAsMe": "Soy yo",
  "people.unmarkMe": "No soy yo",

  // Tasks
  "tasks.title": "Tareas",
  "tasks.toggle.open": "Tareas abiertas",
  "tasks.toggle.done": "Tareas hechas",
  "tasks.toggle.all": "Todas las tareas",
  "tasks.personal.title": "Personal",
  "tasks.personal.placeholder":
    "Añade una tarea personal y pulsa Enter…",
  "tasks.personal.empty":
    "No hay tareas personales. Añade una arriba.",
  "tasks.meetings.title": "De reuniones",
  "tasks.meetings.empty": "Aún no hay acciones de reuniones.",
  "tasks.delete": "Eliminar tarea",
  "tasks.openMeeting": "Abrir reunión",
  "tasks.group.overdue": "Atrasado",
  "tasks.group.today": "Hoy",
  "tasks.group.thisWeek": "Esta semana",
  "tasks.group.later": "Más tarde",
  "tasks.group.noDate": "Sin fecha",
  "tasks.group.todayMeetings": "Reuniones de hoy",
  "tasks.group.older": "Antiguas",
  "tasks.filter.assignee": "Asignado",
  "tasks.filter.anyone": "Cualquiera",
  "tasks.filter.me": "Yo",
  "tasks.filter.priority": "Prioridad",
  "tasks.filter.priorityAny": "Cualquier prioridad",
  "tasks.filter.due": "Vencimiento",
  "tasks.filter.dueAny": "Cualquier fecha",
  "tasks.filter.search": "Buscar tareas…",
  "tasks.filter.reset": "Restablecer filtros",
  "tasks.filter.clear": "Quitar filtro",
  "tasks.empty.title": "No se encontraron tareas",
  "tasks.empty.desc": "Prueba a borrar la búsqueda o restablecer los filtros",
  "tasks.priority.none": "Ninguna",
  "tasks.priority.low": "Baja",
  "tasks.priority.medium": "Media",
  "tasks.priority.high": "Alta",
  "tasks.priority.set": "Definir prioridad",
  "tasks.due.set": "Definir fecha",
  "tasks.due.tomorrow": "Mañana",
  "tasks.due.nextWeek": "Próxima semana",
  "tasks.due.custom": "Elegir fecha…",
  "tasks.due.clear": "Quitar fecha",
  "tasks.add": "Añadir tarea",
  "tasks.addPlaceholder": "Nueva tarea…",
  "tasks.duplicate": "Duplicar",
  "tasks.copyAll": "Copiar todo",
  "tasks.more": "Más acciones",
  "tasks.assignee.set": "Asignar a",

  // Calendar
  "calendar.title": "Calendario",
  "calendar.notConnected": "Ningún calendario conectado.",
  "calendar.resync": "Resincronizar",
  "calendar.resyncing": "Sincronizando…",
  "calendar.view": "Vista del calendario",
  "calendar.listView": "Vista de lista",
  "calendar.monthView": "Vista mensual",
  "calendar.prevMonth": "Mes anterior",
  "calendar.nextMonth": "Mes siguiente",
  "calendar.today": "Hoy",
  "calendar.tomorrow": "Mañana",
  "calendar.yesterday": "Ayer",

  // Settings — section nav
  "settings.title": "Ajustes",
  "settings.section.general": "General",
  "settings.section.general.desc": "Preferencias de la app",
  "settings.section.transcription": "Transcripción",
  "settings.section.transcription.desc": "Motor WhisperX",
  "settings.section.ai": "Proveedor de IA",
  "settings.section.ai.desc": "Motor de notas y resúmenes",
  "settings.section.templates": "Plantillas de notas",
  "settings.section.templates.desc": "Prompts predefinidos por tipo de reunión",
  "settings.section.speakers": "Etiquetas de hablantes",
  "settings.section.speakers.desc": "Acceso a diarización",
  "settings.section.voiceLibrary": "Biblioteca de voces",
  "settings.section.voiceLibrary.desc": "Voces conocidas",
  "settings.section.calendar": "Calendario",
  "settings.section.calendar.desc": "Google Calendar",
  "settings.section.claudeMcp": "Integración Claude",
  "settings.section.claudeMcp.desc": "MCP Claude Desktop / Code",
  "settings.section.about": "Acerca de",
  "settings.section.about.desc": "Versión y enlaces",

  // Settings — language
  "settings.language.title": "Idioma",
  "settings.language.desc":
    "Elige el idioma de la interfaz de Scribe y el de la IA que transcribe y resume tus reuniones.",
  "settings.language.display": "Idioma de la interfaz",
  "settings.language.display.desc":
    "Idioma usado en toda la interfaz de Scribe.",
  "settings.language.ai": "Idioma de la IA",
  "settings.language.ai.desc":
    "Idioma usado para la transcripción y las notas de reuniones. La detección automática identifica el idioma hablado.",
  "settings.language.auto": "Detección automática",
  "settings.language.placeholder": "Seleccionar…",

  // Settings — appearance
  "settings.appearance.title": "Apariencia",
  "settings.appearance.desc":
    "Elige un tema o deja que Scribe siga el sistema.",
  "settings.appearance.theme": "Tema",
  "settings.appearance.theme.desc":
    "Alterna entre claro y oscuro, o sigue al sistema. Pulsa D para cambiar.",
  "settings.appearance.theme.system": "Sistema",
  "settings.appearance.theme.light": "Claro",
  "settings.appearance.theme.dark": "Oscuro",
  "settings.appearance.accent": "Color de acento",
  "settings.appearance.accent.desc":
    "Tiñe los enlaces, botones y selecciones en toda la app.",
  "settings.appearance.accent.indigo": "Índigo",
  "settings.appearance.accent.violet": "Violeta",
  "settings.appearance.accent.blue": "Azul",
  "settings.appearance.accent.teal": "Verde azulado",
  "settings.appearance.accent.emerald": "Esmeralda",
  "settings.appearance.accent.amber": "Ámbar",
  "settings.appearance.accent.rose": "Rosa",
  "settings.appearance.accent.pink": "Rosado",
  "settings.appearance.fontUi": "Fuente de la interfaz",
  "settings.appearance.fontUi.desc":
    "Se usa para el texto y los títulos de la aplicación.",
  "settings.appearance.fontMono": "Fuente monoespaciada",
  "settings.appearance.fontMono.desc":
    "Se usa para las marcas de tiempo de la transcripción y el código.",
  "settings.appearance.font.system": "Sistema",
  "settings.appearance.font.serif": "Serif",
  "settings.appearance.font.custom": "Personalizada…",
  "settings.appearance.font.customPlaceholder":
    "Nombre de la fuente (p. ej. Menlo)",
  "settings.appearance.sidebarWidth": "Ancho de la barra lateral",
  "settings.appearance.sidebarWidth.desc":
    "Arrastra el borde de la barra lateral para ajuste fino, o restablece al valor por defecto.",

  // Settings — transcription / WhisperX
  "settings.whisperx.title": "Motor WhisperX",
  "settings.whisperx.desc":
    "WhisperX ofrece mucha mejor calidad que el transcriptor integrado e identifica hablantes. Se instalan unos 2 GB de dependencias de Python localmente en la primera configuración.",
  "settings.whisperx.install": "Instalar",
  "settings.whisperx.reinstall": "Reinstalar",
  "settings.whisperx.retry": "Reintentar instalación",
  "settings.whisperx.status.installed": "Instalado y listo",
  "settings.whisperx.status.installing":
    "Instalando… puede tardar 3–5 minutos",
  "settings.whisperx.status.notInstalled":
    "No instalado — Scribe usa el transcriptor integrado",
  "settings.whisperx.status.error": "Error",
  "settings.whisperx.status.checking": "Comprobando…",
  "settings.whisperx.preparing": "Preparando…",

  // Settings — speakers / HF token
  "settings.hf.title": "Token de acceso de HuggingFace",
  "settings.hf.descPrefix":
    "Pega un token gratuito de HuggingFace para activar el etiquetado automático de hablantes. Primero debes aceptar los términos de",
  "settings.hf.descSuffix":
    ". Guardado cifrado en el Llavero de macOS.",
  "settings.hf.placeholder": "hf_xxxxxxxxxxxxxxxxxxxxxxxx",
  "settings.hf.getToken": "Obtener un token →",

  // Settings — voice library
  "settings.voice.title": "Voces conocidas",
  "settings.voice.desc":
    "Voces que Scribe ha aprendido hasta ahora. Las nuevas reuniones cotejan hablantes con esta lista — renombra o elimina una entrada para reiniciarla.",
  "settings.voice.empty":
    "Aún no hay voces aprendidas. Etiqueta hablantes en una reunión procesada y aparecerán aquí.",
  "settings.voice.meetingOne": "{count} reunión",
  "settings.voice.meetingMany": "{count} reuniones",
  "settings.voice.deleteEntry": "Eliminar de la biblioteca",
  "settings.voice.deleteTitle": "¿Eliminar esta voz?",
  "settings.voice.deleteDesc":
    "Esta entrada sale de tu biblioteca de voces. Las reuniones pasadas conservan el nombre; las futuras no reconocerán esta voz automáticamente.",
  "settings.voice.clickToRename": "Haz clic para renombrar",

  // Settings — calendar (OAuth)
  "settings.cal.creds.title": "Credenciales OAuth",
  "settings.cal.creds.desc":
    "Scribe necesita un cliente OAuth de Google personal para acceder a tu calendario. Configuración única.",
  "settings.cal.creds.checking": "Comprobando…",
  "settings.cal.creds.notConfigured": "Sin configurar.",
  "settings.cal.creds.showMe": "Mostrarme cómo",
  "settings.cal.creds.clear": "Borrar credenciales",
  "settings.cal.accounts.title": "Cuentas conectadas",
  "settings.cal.accounts.desc":
    "Inicia sesión en una o más cuentas de Google para importar sus calendarios.",
  "settings.cal.accounts.needCreds":
    "Añade las credenciales OAuth arriba antes de conectar una cuenta.",
  "settings.cal.accounts.connect": "Conectar Google Calendar",
  "settings.cal.accounts.waiting": "Esperando al navegador…",
  "settings.cal.accounts.addAnother": "Añadir otra cuenta",
  "settings.cal.accounts.syncNow": "Sincronizar",
  "settings.cal.accounts.disconnect": "Desconectar",
  "settings.cal.accounts.disconnectTitle": "¿Desconectar esta cuenta?",
  "settings.cal.accounts.disconnectDesc":
    "Las grabaciones ya vinculadas se conservan. Los nuevos eventos de esta cuenta dejarán de sincronizarse.",
  "settings.cal.accounts.connectedOn": "conectado el {date}",
  "settings.cal.wizard.title": "Configurar Google Calendar",
  "settings.cal.wizard.clientId": "ID de cliente",
  "settings.cal.wizard.clientSecret": "Secreto de cliente",
  "settings.cal.wizard.save": "Guardar credenciales",

  // Settings — about
  "settings.about.title": "Scribe",
  "settings.about.desc": "Captura de reuniones, local primero.",
  "settings.about.version": "Versión",
  "settings.about.version.desc": "Versión actual en esta máquina.",
  "settings.about.storage": "Almacenamiento",
  "settings.about.storage.desc":
    "Grabaciones, transcripciones y la biblioteca de voces se guardan localmente en ~/Library/Application Support/Scribe.",
  "settings.about.diar": "Modelo de diarización",
  "settings.about.diar.desc":
    "pyannote/speaker-diarization-3.1 vía HuggingFace.",
  "settings.about.diar.link": "Página del modelo →",
  "settings.about.engine": "Motor de transcripción",
  "settings.about.engine.desc": "WhisperX — m-bain/whisperX.",
  "settings.about.engine.link": "GitHub →",

  // Settings — proveedor de IA
  "settings.ai.title": "Motor de notas",
  "settings.ai.desc":
    "Elige cómo Scribe redacta las notas de la reunión. «Integrado» se ejecuta totalmente en tu equipo; Ollama y OpenAI-compatible te permiten usar cualquier modelo local o remoto que siga su API.",
  "settings.ai.provider": "Proveedor",
  "settings.ai.provider.desc": "Motor activo para generar notas.",
  "settings.ai.provider.bundled": "Integrado (local)",
  "settings.ai.provider.ollama": "Ollama",
  "settings.ai.provider.openai": "OpenAI-compatible",
  "settings.ai.provider.anthropic": "API Anthropic (Claude con clave)",
  "settings.ai.provider.claudeCode": "Claude Code (suscripción)",
  "settings.ai.bundled.model": "Modelo",
  "settings.ai.bundled.model.desc":
    "Se guarda en ~/Library/Application Support/Scribe/models. Los modelos más grandes que el Gemma 3 (4B) por defecto deben descargarse explícitamente antes de usarse.",
  "settings.ai.bundled.downloaded": "Descargado",
  "settings.ai.bundled.download": "Descargar",
  "settings.ai.bundled.downloading": "Descargando…",
  "settings.ai.bundled.selected": "Seleccionado",
  "settings.ai.bundled.select": "Seleccionar",
  "settings.ai.bundled.notDownloadedHint":
    "Descarga este modelo antes de generar notas con él.",
  "settings.ai.bundled.downloadFailed": "Descarga fallida",
  "settings.ai.bundled.delete": "Descargar del disco",
  "settings.ai.bundled.deleteConfirm": "Confirmar",
  "settings.ai.ollama.endpoint": "Endpoint",
  "settings.ai.ollama.endpoint.desc":
    "URL de tu servidor Ollama. Por defecto, la app local en el puerto 11434.",
  "settings.ai.ollama.model": "Modelo",
  "settings.ai.ollama.model.placeholder": "Seleccionar modelo",
  "settings.ai.ollama.noModels":
    "Sin modelos. Ejecuta `ollama pull <modelo>` y refresca.",
  "settings.ai.openai.endpoint": "Endpoint",
  "settings.ai.openai.endpoint.desc":
    "URL base compatible con OpenAI. Funciona con OpenAI, LM Studio, vLLM, OpenRouter, Together, Groq, etc.",
  "settings.ai.openai.apiKey": "Clave API",
  "settings.ai.openai.apiKey.desc":
    "Guardada localmente y cifrada con el llavero del sistema.",
  "settings.ai.openai.apiKey.placeholder": "sk-…",
  "settings.ai.openai.apiKey.saved": "Clave guardada",
  "settings.ai.openai.model": "Modelo",
  "settings.ai.openai.model.placeholder": "Seleccionar modelo",
  "settings.ai.openai.noModels":
    "Sin modelos. Verifica el endpoint y la clave, luego refresca.",
  "settings.ai.anthropic.endpoint": "Endpoint",
  "settings.ai.anthropic.endpoint.desc":
    "URL base de la API de Anthropic. Por defecto: api.anthropic.com.",
  "settings.ai.anthropic.apiKey": "Clave API",
  "settings.ai.anthropic.apiKey.desc":
    "Guardada localmente y cifrada con el llavero del sistema. Obtén una en console.anthropic.com.",
  "settings.ai.anthropic.apiKey.placeholder": "sk-ant-…",
  "settings.ai.anthropic.apiKey.saved": "Clave guardada",
  "settings.ai.anthropic.model": "Modelo",
  "settings.ai.anthropic.model.placeholder": "Seleccionar modelo",
  "settings.ai.anthropic.noModels":
    "Sin modelos. Verifica la clave y refresca.",
  "settings.ai.kb.label": "Carpeta de base de conocimientos",
  "settings.ai.kb.desc":
    "Ruta absoluta a una carpeta que el agente puede leer al generar las notas. El agente busca y lee archivos bajo demanda mediante MCP. Déjalo vacío para un resumen de un solo paso.",
  "settings.ai.kb.placeholder": "/Users/tu/Notas",
  "settings.ai.kb.check": "Verificación de carpeta",
  "settings.ai.kb.check.desc":
    "Comprueba que la carpeta existe, es legible y contiene archivos. Gratis — sin llamada al LLM.",
  "settings.ai.kb.check.button": "Verificar",
  "settings.ai.kb.check.ok": "Todo bien",
  "settings.ai.kb.check.missing": "Ruta no encontrada",
  "settings.ai.kb.check.notDir": "La ruta no es una carpeta",
  "settings.ai.kb.check.noAccess": "No legible",
  "settings.ai.kb.check.empty": "Sin archivos legibles",
  "settings.ai.kb.check.error": "Verificación fallida",
  "settings.ai.kb.check.sample": "ej.",
  "settings.ai.claudeCode.status": "Estado del CLI",
  "settings.ai.claudeCode.statusDesc":
    "Ejecuta `claude -p` usando el CLI local de Claude Code bajo tu suscripción Pro/Max. Sin clave API y sin facturación por token — el uso descuenta de la cuota de suscripción (hasta el 15 de junio de 2026; después, de un fondo separado de 100 $/mes a tarifa API).",
  "settings.ai.claudeCode.notInstalled":
    "CLI claude no encontrado en PATH. Instala Claude Code primero.",
  "settings.ai.claudeCode.notAuthed":
    "CLI claude encontrado pero sin sesión iniciada. Ejecuta `claude login` en una terminal.",
  "settings.ai.claudeCode.ready": "Listo",
  "settings.ai.claudeCode.model": "Modelo",
  "settings.ai.claudeCode.askOption": "Preguntar cada vez",
  "settings.ai.claudeCode.askDesc":
    "Elige un modelo antes de cada generación. Útil si quieres usar Haiku para standups y Opus para reuniones estratégicas sin cambiar los ajustes cada vez.",
  "settings.ai.claudeCode.kbDesc":
    "Ruta absoluta a una carpeta que el CLI puede leer. Se pasa como `--add-dir`. Déjalo vacío para no dar acceso adicional al sistema de archivos.",
  "settings.ai.claudeCode.usage.title": "Uso",
  "settings.ai.claudeCode.usage.desc":
    "Totales acumulados de todas las reuniones procesadas con Claude Code. El coste es el valor equivalente a la API que reporta el CLI — bajo tu suscripción Max activa se absorbe; tras el 15 de junio de 2026 sale del fondo de créditos programáticos.",
  "settings.ai.claudeCode.usage.emptyDesc":
    "Aún no se ha procesado ninguna reunión con este proveedor.",
  "settings.ai.test": "Probar conexión",
  "settings.ai.test.ok": "Conectado",
  "settings.ai.test.fail": "Fallo de conexión",
  "settings.ai.save": "Guardar",
  "settings.ai.saved": "Guardado",
  "settings.ai.clear": "Borrar",

  // Settings — Plantillas de notas
  "settings.templates.title": "Plantillas de notas",
  "settings.templates.desc":
    "Una plantilla es la persona y el enfoque que Scribe usa para redactar las notas. El esquema de salida (resumen, secciones, decisiones, tareas, tags) está bloqueado — editas cómo se instruye al LLM, no lo que produce.",
  "settings.templates.default": "Plantilla por defecto",
  "settings.templates.default.desc":
    "Se usa en cualquier reunión que no tenga su propia plantilla.",
  "settings.templates.builtin": "Integrada",
  "settings.templates.custom": "Personalizada",
  "settings.templates.edit": "Editar",
  "settings.templates.save": "Guardar",
  "settings.templates.cancel": "Cancelar",
  "settings.templates.reset": "Restablecer",
  "settings.templates.delete": "Eliminar",
  "settings.templates.new": "Nueva plantilla",
  "settings.templates.name": "Nombre",
  "settings.templates.name.placeholder": "p. ej. Onboarding de cliente",
  "settings.templates.instructions": "Instrucciones",
  "settings.templates.instructions.placeholder":
    "Describe el tipo de reunión y en qué debe centrarse el LLM. Ejemplo: «Estás resumiendo un 1:1. Sé sincero sobre las preocupaciones planteadas. Cada acción debe tener un responsable claro.»",
  "settings.templates.create": "Crear plantilla",
  "settings.templates.confirmDelete":
    "¿Eliminar esta plantilla? Las reuniones que la usan volverán al valor por defecto.",
  "settings.templates.useGlobal": "Usar por defecto",

  // Settings — integración Claude (servidor MCP)
  "settings.mcp.title": "Integración Claude Desktop & Code",
  "settings.mcp.desc":
    "Expón tus reuniones de Scribe a Claude vía el Model Context Protocol. Claude podrá listar, leer, buscar y resumir tus reuniones — combinándolas con lo que ya conoce (tu bóveda de Obsidian, la web, código, etc.).",
  "settings.mcp.status": "Servidor",
  "settings.mcp.status.desc":
    "Indica si el script del servidor MCP está disponible en disco.",
  "settings.mcp.status.ready": "Listo",
  "settings.mcp.status.notBuilt":
    "Aún no compilado. En dev, ejecuta `npm run build:mcp` y pulsa Re-verificar.",
  "settings.mcp.recheck": "Re-verificar",
  "settings.mcp.scriptPath": "Ruta del servidor",
  "settings.mcp.scriptPath.desc":
    "Ruta absoluta del servidor MCP. Úsala en tu configuración de Claude.",
  "settings.mcp.snippet": "Fragmento de configuración",
  "settings.mcp.snippet.desc":
    "Fusiona esto en claude_desktop_config.json bajo \"mcpServers\".",
  "settings.mcp.snippet.copy": "Copiar",
  "settings.mcp.snippet.copied": "Copiado",
  "settings.mcp.claudeConfig": "Config Claude Desktop",
  "settings.mcp.claudeConfig.desc":
    "Abre la carpeta que contiene claude_desktop_config.json para editarlo.",
  "settings.mcp.claudeConfig.reveal": "Mostrar en Finder",
  "settings.mcp.allowWrites": "Permitir editar a Claude",
  "settings.mcp.allowWrites.desc":
    "Si está activado, Claude puede reescribir resúmenes, añadir/marcar tareas, retaggear reuniones, renombrar speakers y editar títulos. Cada cambio queda registrado en {userData}/logs/mcp.log. Desactivado por defecto.",
  "settings.mcp.allowWrites.on": "Escritura activada",
  "settings.mcp.allowWrites.off": "Solo lectura",
  "settings.mcp.nodeRequirement":
    "El servidor MCP usa el módulo SQLite integrado de Node — requiere Node 22 o superior. Claude Desktop en macOS incluye un Node reciente; si ves errores al iniciar, comprueba que `node --version` devuelva 22.x.",

  // Settings — Claude skill
  "settings.mcp.skill.title": "Skill Claude",
  "settings.mcp.skill.desc":
    "Instala el skill `scribe-mcp` globalmente para Claude Desktop y Claude Code. Enseña a Claude cuándo usar las herramientas MCP de Scribe — listar reuniones, reescribir resúmenes, añadir action items en masa — y cómo combinarlas con tu vocabulario Symphonics.",
  "settings.mcp.skill.status": "Estado",
  "settings.mcp.skill.status.desc":
    "Indica si el skill empaquetado coincide con el instalado bajo ~/.claude/skills/.",
  "settings.mcp.skill.status.installed": "Instalado (al día)",
  "settings.mcp.skill.status.outdated":
    "La parte de Scribe está obsoleta. Actualizar la renueva y conserva tus añadidos.",
  "settings.mcp.skill.userSection":
    "Sección personal detectada: se conserva al actualizar y se ignora en la comprobación de obsolescencia.",
  "settings.mcp.skill.preserved":
    "Actualizado. Tu sección personal se ha conservado.",
  "settings.mcp.skill.backedUp":
    "Actualizado. El archivo anterior no tenía marcador de sección personal, así que se hizo una copia de seguridad en:",
  "settings.mcp.skill.status.notInstalled": "No instalado",
  "settings.mcp.skill.status.missing":
    "Skill empaquetado no encontrado (dev: verifica que mcp-server/skills/scribe-mcp/SKILL.md exista).",
  "settings.mcp.skill.path": "Ruta de instalación",
  "settings.mcp.skill.path.desc":
    "Ubicación global estándar que Claude lee al iniciar.",
  "settings.mcp.skill.actions": "Acciones",
  "settings.mcp.skill.actions.desc":
    "Instalar copia el skill empaquetado en ~/.claude/skills/. Tu sección personal (bajo el marcador) se conserva al actualizar. Reinicia Claude Desktop para aplicar los cambios.",
  "settings.mcp.skill.install": "Instalar skill",
  "settings.mcp.skill.update": "Actualizar",
  "settings.mcp.skill.upToDate": "Al día",
  "settings.mcp.skill.uninstall": "Desinstalar",
  "settings.mcp.skill.reveal": "Mostrar en Finder",
  "settings.mcp.skill.bundledMissing":
    "Instalación imposible: skill empaquetado no encontrado. Recompila la app y vuelve a intentarlo.",

  // Command palette
  "palette.placeholder": "Buscar reuniones, ejecutar comandos…",
  "palette.searching": "Buscando…",
  "palette.noResults": "Sin coincidencias.",
  "palette.openHint": "Búsqueda y comandos",
  "palette.group.actions": "Acciones",
  "palette.group.navigation": "Navegación",
  "palette.group.meetings": "Reuniones",
  "palette.group.recent": "Reuniones recientes",
  "palette.group.people": "Personas",
  "palette.group.tags": "Etiquetas",
  "palette.group.folders": "Carpetas",
  "palette.group.preferences": "Preferencias",
  "palette.nav.goTo": "Ir a {target}",
  "palette.tab.switch": "Pestaña: {tab}",
  "palette.action.processMeeting": "Procesar la reunión actual",
  "palette.action.clearTagFilter": "Borrar el filtro de etiqueta",
  "palette.action.find": "Buscar en la página",
  "palette.matchedIn.title": "Título",
  "palette.matchedIn.transcript": "Transcripción",
  "palette.matchedIn.tag": "Etiqueta",
  "palette.matchedIn.summary": "Resumen",
  "palette.theme.light": "Tema: Claro",
  "palette.theme.dark": "Tema: Oscuro",
  "palette.theme.system": "Tema: Sistema",
  "palette.lang.en": "Idioma: English",
  "palette.lang.fr": "Idioma: Français",
  "palette.lang.es": "Idioma: Español",
  "palette.lang.de": "Idioma: Deutsch",

  // Barra superior
  "topbar.refresh": "Actualizar página",

  // Buscar en la página (Cmd+F)
  "find.placeholder": "Buscar en la página",
  "find.matches": "{current} de {total}",
  "find.noMatches": "Sin resultados",
  "find.previous": "Resultado anterior",
  "find.next": "Resultado siguiente",
  "find.matchCase": "Distinguir mayúsculas",
  "find.close": "Cerrar búsqueda",

  // Pipeline badges (meeting header)
  "pipeline.transcribe": "Transcripción",
  "pipeline.align": "Alineación",
  "pipeline.diarize": "Diarización",
  "pipeline.notes": "Notas",

  // Usage badges (meeting header)
  "usage.kb": "KB",
  "usage.calls": "{count} llamadas",
  "usage.sub": "sus",
  "usage.tip.model": "Modelo: {value}",
  "usage.tip.input": "Entrada: {value}",
  "usage.tip.output": "Salida: {value}",
  "usage.tip.cacheRead": "Lectura de caché: {value}",
  "usage.tip.cacheWrite": "Escritura de caché: {value}",
  "usage.tip.cost": "Coste: {value}",
  "usage.tip.costSub": " (a tarifa API; lo absorbe la suscripción)",
  "usage.tip.turns": "Turnos: {value}",
  "usage.tip.duration": "Duración: {value}s",
  "usage.tip.session": "Sesión: {value}",

  // Claude Code usage stats (settings)
  "settings.ai.claudeCode.usage.meetings": "Reuniones",
  "settings.ai.claudeCode.usage.tokens": "Tokens entrada / salida",
  "settings.ai.claudeCode.usage.cacheRead": "Lectura de caché",
  "settings.ai.claudeCode.usage.cost": "Coste (equiv. API)",
  "settings.ai.claudeCode.usage.avg": "Media / reunión",
  "settings.ai.claudeCode.usage.totalTime": "Tiempo total",
  "settings.ai.claudeCode.usage.lastRun": "Última ejecución",

  // Relative time
  "time.justNow": "ahora mismo",
  "time.minAgo": "hace {value} min",
  "time.hoursAgo": "hace {value} h",
  "time.daysAgoShort": "hace {value} d",
  "time.daysAgo": "hace {count} días",

  // Common additions
  "common.email": "Correo electrónico",
  "common.plusMore": "+{count} más",

  // People view
  "people.heardInOne": "Escuchado en 1 reunión",
  "people.heardInMany": "Escuchado en {count} reuniones",
  "people.lastOn": "última el {date}",
  "people.delete.title": "¿Eliminar esta voz?",
  "people.delete.body":
    "“{name}” se eliminará de tu biblioteca de voces. Las reuniones pasadas conservan el nombre del hablante, pero las futuras no reconocerán automáticamente esta voz. Puedes volver a crear la entrada etiquetándola de nuevo.",

  // Processing — steps
  "processing.step.mixAudio": "Mezclar audio",
  "processing.step.alignWords": "Alinear palabras",
  "processing.step.identifySpeakers": "Identificar hablantes",

  // Processing — stages
  "processing.stage.starting": "Preparando",
  "processing.stage.mixing": "Mezclando pistas de audio",
  "processing.stage.loadingRuntime": "Cargando entorno de ejecución",
  "processing.stage.loadingAudio": "Leyendo audio",
  "processing.stage.loadingModel": "Cargando modelo Whisper",
  "processing.stage.transcribing": "Transcribiendo voz",
  "processing.stage.transcribed": "Transcripción lista",
  "processing.stage.loadingAlign": "Cargando alineador",
  "processing.stage.aligning": "Alineando marcas de tiempo",
  "processing.stage.alignFailed": "Alineación no disponible",
  "processing.stage.loadingDiarize": "Cargando diarizador",
  "processing.stage.diarizeLoaded": "Diarizador listo",
  "processing.stage.diarizing": "Detectando hablantes",
  "processing.stage.diarizeSegments": "Mapeando segmentos",
  "processing.stage.diarizeAssigned": "Asignando hablantes",
  "processing.stage.diarizeFailed": "Diarización no disponible",
  "processing.stage.diarizeSkipped": "Diarización omitida",
  "processing.stage.serializing": "Finalizando transcripción",
  "processing.stage.model": "Preparando modelo de lenguaje",
  "processing.stage.loading": "Cargando modelo de lenguaje",
  "processing.stage.generating": "Redactando resumen y tareas",
  "processing.stage.agent": "Leyendo base de conocimiento",
  "processing.stage.writing": "Guardando notas",

  // Processing — headlines
  "processing.headline.generate": "Generando notas",
  "processing.headline.transcribe": "Procesando transcripción",
  "processing.headline.diarize": "Rediarización",
  "processing.headline.default": "Procesando reunión",

  // Tree (folders / meetings)
  "tree.autoTagTooltip": "Auto-etiqueta: #{name}",
  "tree.autoTagAria": "Auto-etiqueta: {name}",
  "tree.newFolderInside": "Nueva carpeta dentro",
  "tree.startMeetingInFolder": "Iniciar reunión en la carpeta",
  "tree.deleteFolder": "Eliminar carpeta",
  "tree.deleteFolderConfirm":
    '¿Eliminar "{name}"? Las reuniones de dentro subirán un nivel.',
  "tree.pinToTop": "Fijar arriba",
  "tree.unpin": "Dejar de fijar",
  "tree.deleteMeetingConfirm":
    '¿Eliminar "{name}"? La grabación, la transcripción y las notas se eliminarán permanentemente.',
  "tree.deleteMeeting": "Eliminar reunión",
  "tree.changeAutoTag": "Cambiar auto-etiqueta",
  "tree.setAutoTag": "Definir auto-etiqueta",
  "tree.autoTag": "Auto-etiqueta",
  "tree.autoMoveHeading": "Mover auto al etiquetar con",
  "tree.noTagsYet": "Aún no hay etiquetas — crea una desde una reunión primero.",

  // Pinned section
  "pinned.heading": "Fijados",

  // Calendar events
  "event.join": "Unirse",

  // Linked event row
  "linkedEvent.unlink": "Desvincular",
  "linkedEvent.notLinked": "No vinculado a un evento del calendario",
  "linkedEvent.autoLink": "Vincular auto",
  "linkedEvent.dialogTitle": "Vincular esta reunión a un evento del calendario",
  "linkedEvent.dialogDesc":
    "Mostrando eventos dentro de ±24 horas de la grabación, ordenados por puntuación de coincidencia. La puntuación considera el solapamiento y la similitud de títulos.",
  "linkedEvent.filterPlaceholder": "Filtrar por título…",
  "linkedEvent.loadingCandidates": "Cargando candidatos…",
  "linkedEvent.noCandidates":
    "No hay eventos coincidentes cerca. Prueba a sincronizar tu calendario.",

  // Tags section
  "tagsSection.show": "Mostrar etiquetas",
  "tagsSection.hide": "Ocultar etiquetas",
  "tagsSection.newTag": "Nueva etiqueta",
  "tagsSection.clear": "limpiar",
  "tagsSection.auto": "auto",
  "tagsSection.deleteTag": "Eliminar etiqueta {name}",
  "tagsSection.tagNamePlaceholder": "nombre de etiqueta",

  // Tag chips
  "tagChips.placeholder": "nombre de etiqueta…",
  "tagChips.autoFromNotes": "Auto-etiqueta desde las notas",
  "tagChips.remove": "Quitar etiqueta {name}",

  // Speakers chip
  "speakersChip.manage": "Gestionar hablantes",
  "speakersChip.needReviewOne": "1 hablante por revisar",
  "speakersChip.needReviewMany": "{count} hablantes por revisar",
  "speakersChip.linked": "{linked} de {total} vinculados a tu biblioteca de voces",

  // Sample audio
  "sample.failed": "No se pudo cargar la muestra",
  "sample.unavailable": "No hay muestra disponible",
  "sample.play": "Reproducir muestra",

  // Model prompt dialog
  "modelPrompt.title": "Elegir un modelo",
  "modelPrompt.desc":
    "Claude (suscripción) está configurado para preguntar cada vez. Elige un modelo para: {intent}.",

  // Meeting notification (floating window)
  "notification.startsInMin": "Comienza en {count} min",
  "notification.startsInOne": "Comienza en 1 min",
  "notification.startingNow": "Comienza ahora",
  "notification.startedAgo": "Comenzó hace {count} min",
  "notification.join": "Unirse a la reunión",

  // Sidebar
  "sidebar.resize": "Redimensionar barra lateral (actual {width}px, mín {min}, máx {max})",

  // Transcript view
  "transcript.speaker": "Hablante",
  "transcript.jumpTo": "Ir a este momento",
  "transcript.empty.title": "Aún no hay transcripción",
  "transcript.empty.body":
    "Ejecuta el pipeline completo (transcripción + notas), o transcribe solo y escribe las notas en otro lugar — p. ej. con Claude Code por MCP.",

  // Calendar view
  "calendar.empty.list":
    "No hay eventos en los próximos 60 días. Pulsa el icono de actualizar para sincronizar.",
  "calendar.past": "Pasado",
  "calendar.eventOne": "{count} evento",
  "calendar.eventMany": "{count} eventos",
  "calendar.empty.upcoming": "Nada próximo. Los eventos pasados están arriba.",
  "calendar.recordedTooltip": "Una grabación de Scribe está vinculada a este evento",

  // Event popover
  "eventPopover.openNotes": "Abrir notas",
  "eventPopover.noRecording": "Aún no hay grabación de Scribe vinculada.",

  // Anthropic model picker
  "modelPicker.required": "· obligatorio",
  "modelPicker.placeholder": "Elegir un modelo…",
  "modelPicker.default": "{model} (predeterminado)",

  // Voice tagging panel
  "voicePanel.unknownOne": "{count} voz desconocida",
  "voicePanel.unknownMany": "{count} voces desconocidas",
  "voicePanel.close": "Cerrar panel de hablantes",
  "voicePanel.empty.noSpeakers":
    "No se detectaron hablantes. Ejecuta el paso de diarización arriba — si sabes cuántas personas hablaron, indica el número primero para un resultado mucho más limpio.",
  "voicePanel.empty.noToken":
    "Añade un token de Hugging Face en Ajustes, luego rediariza esta reunión para etiquetar las voces.",
  "voicePanel.searchPlaceholder": "Buscar o crear contacto…",
  "voicePanel.assign": "Asignar {name}",
  "voicePanel.audioOnly": "Solo muestra de audio",
  "voicePanel.hidePicker": "Ocultar selector",
  "voicePanel.reassign": "Reasignar contacto",
  "voicePanel.createContact": "Añadir “{query}”",
  "voicePanel.notSpeaker": "No es un hablante real",
  "voicePanel.noMatch": "Sin coincidencias para “{query}”.",
  "voicePanel.invitees": "Invitados",
  "voicePanel.recentContacts": "Contactos recientes",

  // Meeting header — flows & speaker prompt dialog
  "header.flow.transcribe.title": "Transcribir la reunión",
  "header.flow.transcribe.desc":
    "Pyannote suele sobrecontar hablantes — indica el número exacto para fijar su agrupación. Déjalo en blanco para estimar.",
  "header.flow.rediarize.title": "Rediarizar hablantes",
  "header.flow.rediarize.desc":
    "¿Cuántas personas hablaron? Volver a ejecutar con un número exacto produce una agrupación mucho más limpia. Déjalo en blanco para que pyannote estime.",
  "header.flow.rediarize.confirm": "Rediarizar",
  "header.flow.process.desc":
    "Transcribir + diarizar + resumir. Indicar el número exacto de hablantes de antemano da a pyannote una agrupación mucho más precisa que su estimación por defecto. Déjalo en blanco para estimar.",
  "header.flow.process.confirm": "Procesar",
  "header.dialog.template": "Plantilla de notas",
  "header.dialog.templateDefault": "Predeterminada",
  "header.dialog.speakerCount": "Número de hablantes",
  "header.dialog.detected": "· detectados actualmente: {count}",
  "header.dialog.speakerCountPlaceholder": "p. ej. 9",

  // Tasks count
  "tasks.countOne": "{count} tarea",
  "tasks.countMany": "{count} tareas",
};
