---
name: scribe-mcp
description: Use whenever the user asks about a Scribe meeting — listing recent meetings, finding one by topic or date, reading a transcript, getting an existing AI summary, extracting action items / décisions across meetings, looking up a known speaker, OR editing a meeting (rewriting summary, writing the key points / scratch pad, adding/checking/deleting action items, tagging, renaming title or speakers — gated by the user's mcp_allow_writes toggle). Scribe is David's local meeting recorder (Electron + Next.js, transcript via whisperX, notes via local or remote LLM). Data is exposed via the local MCP server "scribe" (18 tools — 8 read + 10 write, prefix `mcp__scribe__`). Triggers (FR/EN) — réunion, meeting, daily, standup, stand-up, daily stand-up, daily standup, transcription, transcript, résumé, summary, réécris le résumé, rewrite the summary, notes de réunion, action item, action items, ajoute une tâche, add a task, marque comme fait, mark as done, tâches, décisions, decisions, tague, tag this meeting, renomme, rename, intervenants, participants, speakers, voice library, bibliothèque vocale, Point suivi, MARI, RTE, TedTalk, Symphonics daily, Scribe, my meetings, mes réunions, dernière réunion, last meeting, today's meeting, réunion d'aujourd'hui, what did we decide, qu'est-ce qu'on a décidé, qu'est-ce qu'on a dit sur, action items ouvertes, open action items, points clés, key points, bullets, bullet points, TL;DR, synthèse en bullet points, scratch pad, scratchpad, bloc-notes, brouillon, notes perso, ajoute aux points clés, écris dans le bloc-notes, set bullets, set scratchpad.
---

# Scribe MCP — accès aux réunions de David

David utilise **Scribe**, son enregistreur de réunions local (Electron + Next.js, transcription whisperX, diarisation pyannote, notes via LLM bundled ou Anthropic). Toute sa donnée — réunions, transcripts, résumés, tâches, bibliothèque vocale — est exposée par le **serveur MCP local "scribe"** (préfixe `mcp__scribe__`).

## Règle d'or

**Si la question concerne une réunion**, utilise les outils MCP `scribe` avant tout. Ne demande pas confirmation pour les outils en lecture seule. Pour un sujet Symphonics présent dans la transcription (plan de chauffe, MARI, RTE, …), **combine avec la skill `symphonics`** pour traduire le jargon métier correctement.

## Outils disponibles

### Lecture (toujours disponible)

| Outil | Quand l'utiliser |
|---|---|
| `mcp__scribe__list_meetings` | Lister les réunions récentes ou filtrer par plage de dates. **Toujours commencer par là** quand l'utilisateur ne donne pas d'id. Args : `from_ms`, `to_ms`, `limit` (défaut 100). |
| `mcp__scribe__search_meetings` | Recherche full-text dans les transcripts (FTS5, supporte `"phrase exacte"`, `AND/OR/NOT`, `prefix*`). À utiliser quand l'utilisateur référence une réunion par sujet plutôt que par date. Retourne un snippet entouré de `«…»`. |
| `mcp__scribe__get_meeting` | Métadonnées d'une réunion : titre, statut, speakers (avec confidence diarisation), tags, événement Google Calendar lié, **plus les points clés (`meeting.bullets`) et le bloc-notes (`meeting.scratchpad`)**. **Ne contient pas le transcript** — appelle `get_transcript` séparément ; le résumé complet est dans `get_summary`. |
| `mcp__scribe__get_meetings` | **Bulk** : récupère métadonnées + résumé pour plusieurs réunions en un seul appel (`ids: string[]`, max 50). À utiliser après `search_meetings` quand tu veux les infos de plusieurs hits, ou pour comparer N dailies. Les ids inconnus sont retournés avec `found: false` (pas d'exception). |
| `mcp__scribe__get_transcript` | Transcript complet, format `segments` (défaut, structuré) ou `plain` (`[mm:ss] Speaker: text`). Les noms sont déjà résolus via la voice library quand possible. Attention : 2h de réunion = beaucoup de segments — ne le lis que si nécessaire. |
| `mcp__scribe__get_summary` | Résumé IA déjà généré (executive_summary, full_summary, sections, decisions). Retourne `null` si `has_summary === false`. *Pour plusieurs réunions, préfère `get_meetings` qui inclut déjà le résumé.* |
| `mcp__scribe__get_action_items` | Tâches extraites, agrégeables sur plusieurs réunions. Args : `meeting_id?`, `open_only?` (filtre sur `done = 0`), `since_ms?`, `limit?` (200 max 500). Retourne `assignee_name` déjà résolu. |
| `mcp__scribe__list_people` | Personnes connues dans la voice library (speakers liés cross-meeting). |
| `mcp__scribe__get_person` | Détails sur une personne : nom, dernier passage entendu, réunions récentes où elle a parlé. |

### Écriture (gate `mcp_allow_writes`, désactivée par défaut)

Toutes les écritures sont **gatées** par le toggle "Autoriser Claude à modifier" dans **Scribe → Settings → Intégration Claude**. Si le gate est OFF, chaque appel d'écriture renvoie une erreur claire indiquant à l'utilisateur où l'activer. Chaque appel (autorisé, refusé, ou en erreur) est tracé dans `${userData}/logs/mcp.log` (JSON-line par opération avec `ts`, `tool`, `args`, `status`, `durationMs`).

**🚨 RÈGLE BULK** : tous les outils de plusieurs items prennent **un tableau** et exécutent **une seule transaction SQLite atomique** (tout passe ou tout est rollback). **NE JAMAIS boucler côté Claude** — un seul appel suffit pour N items. Si l'un des items échoue, aucun n'est appliqué.

| Outil | Quand l'utiliser |
|---|---|
| `mcp__scribe__set_summary` | Réécrire intégralement le résumé d'une réunion (par exemple après l'avoir enrichi avec le jargon Symphonics depuis le vault). Schéma fixe : `executive_summary[]`, `full_summary`, `sections[]?`, `decisions[]?`. **Les champs prose acceptent du markdown GFM** (`full_summary`, `sections[].content`, `decisions[]`, `executive_summary[].detail`) ; `topic` et `title` restent en texte brut. `generated_at_ms` est ajouté automatiquement. **Étape terminale du traitement via MCP** : bascule aussi le statut → `done` et tamponne le badge `Claude · MCP` dans `pipeline.notes` (même état final que la passe « Process meeting » de l'app) — une réunion résumée ainsi n'apparaît plus comme non traitée (coincée en `diarized`). |
| `mcp__scribe__set_bullets` | Remplacer les **points clés** (le TL;DR en puces de l'onglet "Points clés"). Args : `meeting_id`, `bullets: string[]` (puces courtes, une ligne chacune, markdown inline OK, **pas de `•` en préfixe** ; tableau vide = efface). Stocké **séparément du résumé** — ne touche ni `executive_summary` ni les autres champs (utilise `set_summary` pour ceux-là). Idéal pour (re)générer les points clés d'une réunion déjà résumée **sans relancer toute la passe de notes** : lis `get_summary`, condense en 4-8 puces, écris. |
| `mcp__scribe__set_scratchpad` | Remplacer le **bloc-notes** libre (onglet "Bloc-notes"). Markdown brut, **propriété de l'utilisateur** — jamais généré par le pipeline. Args : `meeting_id`, `text` (contenu complet ; chaîne vide = efface). **Écrase tout** : pour ajouter sans perdre l'existant, lis d'abord `get_meeting` (champ `scratchpad`) et renvoie le texte combiné. |
| `mcp__scribe__set_meeting_title` | Renommer une réunion. Idéal pour remplacer "Untitled meeting" par un titre dérivé du contenu. |
| `mcp__scribe__add_action_items` | **Bulk** : ajouter 1 à 100 tâches à une réunion. Args : `meeting_id`, `items: [{text, assignee_speaker_id?}]`. Toujours passer un tableau — même pour 1 item (`items: [{text: "..."}]`). |
| `mcp__scribe__set_action_items_done` | **Bulk** : cocher/décocher 1 à 200 tâches. Args : `updates: [{task_id, done}]`. |
| `mcp__scribe__delete_action_items` | **Bulk** : supprimer définitivement 1 à 200 tâches. Args : `task_ids: number[]`. Pas d'undo — préfère `set_action_items_done(done: true)` quand l'utilisateur "ferme" plutôt que "supprime". |
| `mcp__scribe__tag_meeting` | **Bulk** : attacher 1 à 20 tags à une réunion. Args : `meeting_id`, `tag_names: string[]`. Crée les tags manquants (match case-insensitive). Idempotent. |
| `mcp__scribe__untag_meeting` | **Bulk** : détacher 1 à 20 tags d'une réunion. Args : `meeting_id`, `tag_ids: string[]`. |
| `mcp__scribe__rename_speakers` | **Bulk** : renommer 1 à 50 speakers à travers une ou plusieurs réunions. Args : `renames: [{meeting_id, speaker_id, display_name}]`. Local à chaque réunion (pour propager cross-meeting via la voice library, l'utilisateur le fait dans Settings → Speakers). |

**Important sur la live UI** : l'app Electron de Scribe lit la base au chargement de chaque vue. Si l'utilisateur a une réunion ouverte au moment où tu écris, **la UI ne se rafraîchit pas live** — il devra rouvrir la réunion ou recharger la liste. Préviens-le dans tes confirmations ("Réécrit. Recharge la réunion dans l'app pour voir le nouveau résumé").

## Workflows fréquents

### "Résume la réunion d'aujourd'hui" / "le daily de ce matin"

1. `list_meetings` avec `from_ms` = début de la journée locale (00:00) et `to_ms` = maintenant.
2. Repère la réunion (par titre ou heure).
3. Si `has_summary === true` → `get_summary` (rapide, déjà rédigé).
4. Si non, ou si l'utilisateur veut une vue plus riche : `get_transcript` (format `plain`) puis rédige en français en t'appuyant sur **la skill `symphonics`** pour le jargon.

### "Qu'est-ce qu'on a décidé sur X" / "trouve la réunion où on a parlé de Y"

1. `search_meetings` avec la query (préfère les phrases exactes pour les acronymes : `"CT_PROD_5"`, `"plan de chauffe"`).
2. Sur les hits : `get_summary` ou `get_transcript` selon ce que l'utilisateur veut.
3. Cite la réunion source (titre + date) et un timestamp `[mm:ss]` si tu cites le transcript verbatim.

### "Mes action items ouvertes cette semaine"

1. `get_action_items` avec `open_only: true` et `since_ms` = il y a 7 jours (`Date.now() - 7*24*3600*1000`).
2. Regroupe par `assignee_name` ou par `meeting_title` selon ce qui aide le plus.
3. Items où `assignee_name === null` sont les "Unassigned" — flag-les comme à clarifier.

### "Compare les deux derniers dailies"

1. `list_meetings` filtré sur les standups (titre contient `daily` / `stand`).
2. `get_summary` sur les deux (préfère résumé existant si possible).
3. Diff par section : ce qui a bougé, nouvelles décisions, action items reportées.

### "Qui parle souvent dans mes réunions Symphonics"

1. `list_people` → liste avec `n_meetings`.
2. `get_person({ id })` pour les noms qui intéressent l'utilisateur → `last_meeting` + `meetings[]`.

## Combiner avec la skill `symphonics`

Quand une réunion mentionne du jargon Symphonics (MARI, plan de chauffe, EDP, TOTEM, RTE, etc.), **lis aussi le vault** (`/Users/david/Symphonics`) **avant** de rédiger un résumé enrichi. La skill `symphonics` te donne les fichiers à consulter par domaine. Le combo qui marche :

1. `get_transcript` (format `plain`) pour la matière brute.
2. Skill `symphonics` → glossaire + spec pertinente (ex : `Spec 34 - MA v4 - Programmation et MARI`).
3. Rédige les notes en utilisant les bons termes ("Programme d'Appel" pas "schedule", "Pdispo" pas "available power").
4. Si une décision touche une spec, propose à l'utilisateur d'ajouter une décision (`04 - Décisions/YYYY-MM-DD - Titre.md`) ou de mettre à jour la spec.

## Format des données

### Timestamps
Tous les champs `*_ms` sont en **epoch milliseconds (UTC)**. Le fuseau de David est **Europe/Paris** (CET/CEST). Pour `from_ms` "aujourd'hui à 00h" : utilise l'heure locale convertie en UTC, ou simplement `new Date().setHours(0,0,0,0)`.

### Statuts de réunion
- `recording` / `recorded` : enregistrement en cours ou tout juste terminé (pas de transcript).
- `transcribing` : transcription en cours (ou bloquée — cf. note sur le TedTalk).
- `transcribed` / `diarized` : transcript prêt, pas encore de résumé.
- `done` : transcript + résumé prêts (`has_summary === true`). Atteint par la passe « Process meeting » de l'app **ou** par un `set_summary` via MCP (qui bascule le statut et tamponne `pipeline.notes = Claude · MCP`).
- `error` : pipeline cassée — l'utilisateur doit relancer manuellement.

### Pipeline (champ `pipeline_json`)
JSON avec les modèles utilisés : `transcribe` (whisperx · large-v3-turbo généralement), `align` (wav2vec2), `diarize` (pyannote), `notes` (gemma 3-4b / 3-12b / openai / claude selon Settings ; **`Claude · MCP`** quand le résumé a été écrit via l'outil MCP `set_summary`). `notes_template_name` indique le template ("Daily standup", "General meeting", "Sales discovery call", "User research interview", ou un custom).

### Résumé (`summary_json`)
Quand `has_summary === true`, le résumé contient : `executive_summary[]` (bullets `{topic, detail}`), `full_summary` (prose 4-8 phrases), `sections[]` (par topic `{title, content}`), `decisions[]` (strings). Les action items sont dans une table séparée (`get_action_items`).

**Format : markdown (GFM).** Les champs prose — `full_summary`, chaque `sections[].content`, chaque `decisions[]`, et chaque `executive_summary[].detail` — sont du **markdown GitHub-flavored**. Ils sont rendus comme tels dans l'app Scribe : gras, italique, listes à puces / numérotées, liens, `code` inline, tables, blockquotes. Les champs `executive_summary[].topic` et `sections[].title` restent du **texte brut** (ils sont déjà rendus comme titres dans l'UI — ne préfixe pas avec `#`).

Quand tu lis un résumé existant via `get_summary` / `get_meetings`, traite la prose comme du markdown (suis les liens, respecte les emphases). Quand tu **écris** via `set_summary`, utilise le markdown pour structurer : `**Antoine**` pour les responsables, listes pour les enumérations, ``code`` pour les identifiants (CT_PROD_5, MARI), `[texte](url)` quand une URL a été mentionnée. **Ne wrappe pas une section entière dans une code fence et n'invente pas de titres `#`/`##`** — les titres de section sont déjà rendus comme headings par l'app.

### Points clés (`bullets`) et bloc-notes (`scratchpad`)

Deux champs **distincts du résumé**, exposés sur `meeting` par `get_meeting` / `get_meetings` :

- **`bullets`** — tableau de chaînes (le TL;DR en puces, markdown inline autorisé), ou `null` si pas encore généré. Produit **automatiquement dans la passe de notes** en même temps que le résumé. Écris-le via `set_bullets` (remplace toute la liste). Pour backfiller une ancienne réunion sans relancer les notes : `get_summary` → condense en 4-8 puces → `set_bullets`.
- **`scratchpad`** — texte markdown **libre de l'utilisateur**, jamais touché par le pipeline LLM. Écris-le via `set_scratchpad` (écrase tout — lis d'abord si tu veux ajouter).

## Bonnes manières

- **Réponds en français** par défaut (matche la langue de l'utilisateur).
- **Cite les réunions** : `**Titre** · YYYY-MM-DD HH:MM` avec le `meeting_id` court entre parenthèses si tu prévois d'y revenir.
- **Cite les timestamps du transcript** sous la forme `[mm:ss]` quand tu cites verbatim.
- **Ne lis pas un transcript entier** si l'utilisateur veut juste le résumé — `get_summary` est 100× plus court.
- **Si le résumé est null** mais `status === "done"`, c'est une incohérence — flag-le et propose à l'utilisateur de relancer "Process meeting" dans Scribe.
- **Si une réunion est coincée en `transcribing`** depuis longtemps (ex : le TedTalk de Scribe), c'est probablement une session interrompue ; l'utilisateur doit aller la relancer dans l'app.

## Workflows d'écriture

### "Réécris le résumé de mon daily en gardant le jargon Symphonics"

1. `get_meeting(id)` pour récupérer le titre + statut (sanity check).
2. `get_transcript(id, format: "plain")` pour la matière brute.
3. Skill `symphonics` → glossaire + spec(s) pertinente(s).
4. Rédige le nouveau résumé en français avec le bon vocabulaire métier.
5. `set_summary({meeting_id, executive_summary, full_summary, sections, decisions})`.
6. Dis à l'utilisateur de **recharger la réunion dans l'app** pour voir le résultat.

### "Ajoute les points clés / fais-moi un TL;DR de cette réunion"

1. `get_summary(id)` si elle est déjà résumée (sinon `get_transcript(id, format: "plain")`).
2. Condense en **4-8 puces courtes**, une idée par ligne, sans `•` en préfixe.
3. **Un seul** `set_bullets({meeting_id, bullets: ["…", "…"]})` — remplace toute la liste.
4. Dis à l'utilisateur de recharger la réunion (onglet **Points clés**).

### "Note ça dans le bloc-notes de la réunion" / "ajoute X au scratchpad"

1. Si l'utilisateur veut **ajouter** (pas remplacer) : `get_meeting(id)` → lis `meeting.scratchpad` existant.
2. Compose le nouveau contenu (existant + ajout, ou juste le nouveau si remplacement).
3. `set_scratchpad({meeting_id, text})` — **écrase tout** le bloc-notes.
4. Dis à l'utilisateur de recharger la réunion (onglet **Bloc-notes**).

### "Ajoute 5 action items à la réunion d'aujourd'hui"

1. `list_meetings({from_ms: début_du_jour})` → trouve la bonne.
2. `get_meeting(id)` → liste des speakers (pour résoudre `assignee_speaker_id` si l'utilisateur mentionne un nom).
3. **Un seul** `add_action_items({meeting_id, items: [{text, assignee_speaker_id}, {text, …}, …]})` avec tous les items dans le tableau. **NE PAS boucler.**
4. Confirme avec les ids retournés des tâches.

### "Compare les 3 dernières réunions Symphonics"

1. `search_meetings("Symphonics OR MARI")` ou `list_meetings` → récupère les ids.
2. **Un seul** `get_meetings({ids: [id1, id2, id3]})` au lieu de 3 `get_meeting` séparés — récupère métadonnées + résumés en un appel.
3. Si tu as besoin du verbatim : `get_transcript` par réunion (ce tool reste unitaire — un transcript peut faire 100KB+).

### "Tague mes 3 dernières dailies en `daily`, `symphonics` et `archive`"

1. `list_meetings` → récupère les 3 dernières.
2. Pour chaque réunion (3 appels, **pas plus**) : `tag_meeting({meeting_id, tag_names: ["daily", "symphonics", "archive"]})` — les 3 tags en un seul appel atomique. Idempotent : un re-tag ne casse rien.

### "Marque toutes mes action items ouvertes du daily de lundi comme faites"

1. `get_action_items({meeting_id, open_only: true})` → récupère la liste.
2. Demande confirmation à l'utilisateur (cocher tout d'un coup est irréversible niveau intent).
3. **Un seul** `set_action_items_done({updates: [{task_id: 12, done: true}, {task_id: 13, done: true}, …]})`.

### "Renomme tous les SPEAKER_00 en 'Antoine' dans mes 5 dernières dailies"

1. `list_meetings` filtré → 5 ids.
2. `get_meetings({ids})` → vérifie que chaque réunion a bien un `SPEAKER_00`.
3. **Un seul** `rename_speakers({renames: [{meeting_id: m1, speaker_id: "SPEAKER_00", display_name: "Antoine"}, ...]})`.

## Posture vis-à-vis des écritures

- **Ne fais jamais d'écriture sans intent explicite** ("réécris", "ajoute", "supprime", "tague", "renomme"). Une question ("qu'est-ce qu'on a décidé") = lecture seule.
- **Confirme les écritures destructives** : `delete_action_item`, modification d'un résumé existant non-vide, renommage en masse. Pour les ajouts simples (nouvelle tâche, nouveau tag), procède directement.
- **Une réunion à la fois** par défaut. Si l'utilisateur demande "tague mes 10 réunions", liste-les d'abord, fais valider la liste, puis exécute.
- **Gate refusé** : ne propose pas de contourner via SQL ou édition de fichiers — explique seulement où activer le toggle (Scribe → Settings → Intégration Claude).

## Limites actuelles

- Pas d'accès aux fichiers audio (.wav) — seulement le texte transcrit.
- La voice library est globale (cross-meeting) mais `rename_speaker` est local à la réunion. Pour propager un nom à tous les meetings, l'utilisateur le fait via la voice library dans l'app.
- Pas de transaction multi-tools : si tu enchaînes 5 écritures et la 3e échoue, les 2 premières sont déjà appliquées. Préviens l'utilisateur quand tu fais des batches.
- Les speakers non-liés gardent leur `speaker_id` brut (`SPEAKER_00`) jusqu'à ce que l'utilisateur ou Claude (via `rename_speaker`) le change.

<!-- ───────────────────────────────────────────────────────────────────── -->
<!-- ZONE PERSO — tout ce qui suit le marqueur ci-dessous t'appartient.      -->
<!-- Scribe ne réécrit jamais cette zone : elle est CONSERVÉE à chaque        -->
<!-- « Mettre à jour la skill » et IGNORÉE par la détection « obsolète ».     -->
<!-- Ajoute tes règles perso sous le marqueur, sans le déplacer ni l'éditer.  -->
<!-- ───────────────────────────────────────────────────────────────────── -->
<!-- scribe:user-section -->

## Mes ajouts

<!-- Ajoute ici tes personnalisations (workflows perso, ponts vers d'autres outils, règles maison…). Elles survivent aux mises à jour de la skill. -->
