# MystherAI — Feature & Capability Inventory

> Purpose of this document: a single reference an agent (or a human comparing tools) can read to understand **what MystherAI actually does**, **what data/tags it manages**, and **what capabilities exist per module** — without having to read the whole codebase. Written 2026-09-13 from the live source in `MystherAI_Proyect`.

## 1. One-line description

Internal team tool that turns a catalog of raw "Censo" videos into stylized (anime/cartoon/cyberpunk/etc.) versions via WaveSpeed generative models, with a full reservation → generation → review workflow so a small team can divide, track, and QA the work.

## 2. Architecture tags

`monorepo` · `single-container-deploy` · `django-rest-api` · `react-spa` · `gradio-tool` · `postgres-supabase` · `aws-ecs` · `dual-process-container`

| Part | Tech | Role |
|---|---|---|
| `backend/` | Django 4.2 (Python 3.12), DRF | REST API, auth, admin, data model, business logic, all analytics |
| `frontend/` | React + Vite | SPA dashboard — catalog browsing, review, stats, admin panel |
| `gradio-service/` | Gradio + WaveSpeed SDK | The actual AI generation pipeline (image/video stylization) |

Production: **one Docker image**, one ECS task, two processes (`gunicorn` on :8080 serving Django + the built React static files, `python app.py` on :7860 serving Gradio). Postgres lives in Supabase (project "PORTAL AUTH") — free-tier plan auto-pauses after 7 days of inactivity, mitigated by a daily GitHub Actions keepalive hitting `/api/auth/health/`.

## 3. Core domain model — the "tags" system

Everything in the product revolves around one table: `VideoMetadata` (`backend/apps/sheets/models.py`). A single row is either a **Censo** entry (raw source video) or a **Registro** entry (a finished stylized submission), distinguished by `tipo`.

### 3.1 Classification tags (Censo — describe the raw video)

| Tag field | Meaning | Used for |
|---|---|---|
| `especie` | Humano / Animal / Multitud / Entorno | species/subject-type filter + analytics breakdown |
| `genero` | subject gender | filter + cross-tab analytics (género × etnia) |
| `etnia` | subject ethnicity | filter + cross-tab analytics |
| `mapa` | source map/location | filter + per-map coverage stats, "maps with only male subjects" gap report |
| `camara` | camera/shot metadata | filter + analytics breakdown |
| `duracion` | clip duration (seconds) | analytics (average duration, total seconds) |
| `plano` | shot framing | filter |
| `interior` | interior/exterior flag | filter |
| `accion` | action/pose category | filter + feeds the "action plan" gap report |
| `id_video_equipo` | team-internal video ID | cross-referencing censo ↔ registro |
| `estado_censo` | Disponible / Reservado / Estilizado | reservation-system state machine |
| `reservado_por` | which team member holds the reservation | reservation ownership |

### 3.2 Production tags (Registro — describe a finished stylization)

| Tag field | Meaning |
|---|---|
| `estilizado` | which visual style was applied (Anime, Cartoon, Ciberpunk, …) |
| `prompt_imagen` / `prompt_video` / `prompt_final` | the actual prompts used at each pipeline step (kept for reproducibility/audit) |
| `imagen_link` | I2I (stylized frame) result URL |
| `video_original_link` / `drive_link` | source video / final stylized video links |
| `estado_revision` | Pendiente / Aprobado / Rechazado — review workflow state |
| `comentario_revision` | admin's review note (shown to the author) |
| `usuario` | team member who produced the entry |

**Why this matters for an agent doing comparatives**: MystherAI's "tagging" is not free-form/ML-inferred — it is a fixed, admin-defined taxonomy backed by relational fields (not embeddings/labels-as-strings-only), which means every tag is independently filterable, cross-tabulatable, and drives concrete UI (dropdown filters are generated dynamically from `FilterOptionsView`, i.e. from whatever distinct values already exist in the DB — no hardcoded option lists to keep in sync).

## 4. Feature inventory by module

### 4.1 Auth & identity — `apps/authentication`, `apps/users`
`session-auth` · `csrf-protected` · `role-based` · `db-health-aware`

- Email/password login (Django session auth, not JWT/OAuth).
- Explicit DB-down vs bad-credentials error separation (`{"causa":"db"}` vs `{"causa":"credenciales"}`) — a 503 with a specific human message instead of a misleading "wrong password" when Supabase is paused.
- `/api/auth/health/` — liveness probe hitting the DB directly; used by the keepalive workflow and for triage ("is it the DB or the code").
- Per-user avatar (base64, stored on the user row) + a public avatar map endpoint for showing team members' avatars anywhere (e.g. next to reservations) without an auth check.
- Roles: **Admin (staff)** vs **team member**, enforced via two custom DRF permission classes (`PuedeEscribirVideos`, `EsAdmin`).
- Former-employee accounts are deactivated (`is_active=False`), never deleted — preserves historical attribution of past work.

### 4.2 Censo (Catálogo) & Registro (Biblioteca) — shared `VideoGalleryLayout` component
`filterable-gallery` · `dynamic-filters` · `inline-edit` · `zoom-lightbox` · `search`

One React component (`components/VideoGalleryLayout.jsx`) powers both `/censo` and `/registro` pages (parameterized by `tipo`), giving:
- Free-text search + a dynamic filter bar (one dropdown per tag field, options populated live from the DB via `FilterOptionsView` — new tag values that appear in the data show up automatically).
- Card grid with tag badges (colored by field), click-to-zoom/pan image viewer, inline metadata edit form.
- Add/edit/delete of individual entries (permission-gated).

### 4.3 Reservation workflow (Censo)
`state-machine` · `team-coordination` · `auto-release`

- `estado_censo`: Disponible → Reservado → Estilizado.
- `ReservarVideoView` / `LiberarVideoView` — a member claims/releases a video.
- `AsignarCensoView` — admin bulk-distributes the remaining unreserved catalog across the team ("Repartir censo" in `/profile`).
- `limpiar_reservas` management command — sweeps reservations belonging to people no longer on the team.
- `fill_estado_censo` — cross-references `censo.csv`/`registro.csv` to (re)derive `estado_censo` when the source-of-truth sheets get out of sync with the DB.

### 4.4 Review / approval workflow (Registro)
`human-in-the-loop-qa` · `soft-audit-trail`

- New submissions land as `estado_revision = Pendiente`.
- `AprobarVideoView` / `DenegarVideoView` — admin approves or rejects, with a free-text `comentario_revision` shown back to the author.
- Side-by-side original vs stylized view in `/profile` for the reviewer.
- Special case: denying a submission from a **former employee** auto-deletes the registro row and flips the source censo video back to `Disponible` (so the work re-enters the pool instead of being stuck attributed to someone who's gone) — `FORMER_EMPLOYEES` set in `sheets/views.py`.

### 4.5 Estudio AI — the Gradio generation pipeline (`gradio-service/app.py`)
`4-step-pipeline` · `multi-model` · `i2i` · `v2v` · `wavespeed-api` · `deep-link-launch`

A 4-tab Gradio Blocks app, opened via deep link from Registro (`?video_url=&usuario=&video_id=`) so the pipeline auto-fills context:

1. **01 CARGAR** — upload or paste a Drive/HTTP video URL; auto-resolves Google Drive share links to direct-download; analyzes frame count/fps/duration (OpenCV) and lets the user scrub to a frame and capture it as a still.
2. **02 EDITAR** *(optional)* — ffmpeg-based trim to the segment actually needed before spending generation credits on it.
3. **03 IMAGEN (I2I)** — stylizes the captured frame. 8 built-in style presets (Anime, Cartoon, Lego, Ciberpunk, Realista, Acuarela, Óleo, Pixel Art) each mapping to a ready-made prompt, editable/overridable by the user; 3 selectable models of increasing cost/quality: **Nano Banana Lite** (fast) → **Nano Banana 2** (standard) → **Hunyuan Image 3** (premium).
4. **04 V2V** — takes the stylized frame + reference video and generates the final stylized video. 2 selectable models: **WAN 2.1 480p** (fast, ~1min) or **Kling Video O3 Pro** (high quality).
5. **Guardar** — one button posts the finished result straight into Registro as `Pendiente`, carrying over `video_id`, style, and both prompts automatically (no manual re-entry).

Cross-cutting: every step's state (source video, captured frame, style URL, prompts) is threaded through Gradio `State` objects so the user can skip step 02, jump back and forth, or land straight on IMAGEN/V2V from a "continue" button without re-uploading anything. Pipeline errors (per step, per model) are fire-and-forget logged to the backend (`GradioErrorView`) tagged by team member/step/model — surfaces as an "Errores" tab in `/profile` instead of vanishing into a Gradio traceback the admin never sees.

### 4.6 Análisis (Estadísticas) — analytics dashboard
`kpi-dashboard` · `cross-tab-analytics` · `gap-analysis` · `per-user-breakdown`

Two large summary endpoints (`CensoSummaryView`, `RegistroSummaryView`) compute, straight from `censo.csv`/DB (no separate warehouse):
- Headline KPIs: total videos, breakdown by `especie`, average/total duration, total distinct maps, per-user video counts (fully dynamic — no hardcoded team-member list).
- Distribution charts: género, etnia, cámara, duración, especie.
- Cross-tab: género × etnia.
- Per-map stats including gender/ethnicity coverage per map.
- **Gap-analysis views**: `mapasSoloHombres` (maps that only have male subjects captured — a coverage gap), `exclusivasMateo`/`exclusivasMiguel` (legacy per-person exclusive-content tracking), `actionPlan` (derived worklist of what's missing).
- Registro-side equivalent stats over the stylized output (adoption per style, per model, approval rate, etc. — same pattern, separate 700-line view).

### 4.7 Panorama (Resumen) page
`overview` · `at-a-glance`

A condensed cross-section view (1290 lines of React) sitting between the raw galleries and the full analytics — a middle-ground overview page.

### 4.8 Profile — admin & personal control panel
`role-aware-ui` · `team-ops` · `self-service`

Tabs, admin-only ones only rendered for staff:
- **Mis Reservas** / **Estilizados** — every user's own reserved videos and their own submission history + review status.
- **Estilizados Equipo** *(admin)* — every team member's submissions, approve/deny inline.
- **Reservas Equipo** *(admin)* — every active reservation team-wide + the "Repartir censo" bulk-assign action.
- **Errores** *(admin)* — logged Gradio pipeline failures, filterable by member/step/model.
- **Enlaces** *(admin)* — media-health report (see 4.9).

### 4.9 Reliability / data-integrity tooling
`link-health-check` · `db-failover-messaging` · `data-migration-safety` · `resolution-audit`

- `MediaHealthView` — actively re-checks stored video/image URLs (Drive + WaveSpeed/CloudFront links) and classifies them as OK/broken/timeout, with per-field and per-row breakdowns, surfaced as the "⚠ SIN VIDEO" filter in Registro and the "Enlaces" admin tab. Directly targets a known issue: WaveSpeed's CloudFront output URLs are not guaranteed permanent and nothing currently re-uploads them to durable storage.
- `backup_datos` command — inventory / export / verify-against-DB backup tool, built specifically for a Supabase project migration.
- `extract_metadata` + `ExtractMetadataView` — background (threaded subprocess) metadata-extraction job over an external Excel roster (`MATEO METADATA.xlsx`), with a poll-for-progress GET endpoint.
- `delete_1080p_videos` — Drive-API-driven cleanup command that removes any censo entry (DB row + `censo.csv` row) whose source resolution is ≥1080p (a quality/format gate applied after the fact).
- `sync_sheets` / `sync_censo_csv` / `sync_registro` — one-way sync commands pulling the historical Google Sheets/Excel source-of-truth into the DB, composite-keyed to survive duplicate video IDs with different styles.

## 5. Capability comparison matrix (for evaluating against other tools)

| Capability | MystherAI | Notes |
|---|---|---|
| Multi-model image stylization | ✅ (3 models) | swappable per job, not locked to one vendor |
| Multi-model video stylization | ✅ (2 models) | fast vs quality tiers explicitly exposed to the user |
| Structured, filterable tagging | ✅ (11 fields) | relational, not freeform; filters generated from live data |
| Cross-tab / gap analytics | ✅ | e.g. representation gaps (maps missing a gender) — not just counts |
| Team reservation/locking system | ✅ | prevents duplicate work on the same source video |
| Human review/approval gate | ✅ | nothing reaches "done" without admin sign-off |
| Audit trail of prompts used | ✅ | `prompt_imagen`/`prompt_video`/`prompt_final` stored per entry |
| Broken-asset detection | ✅ | active link health-check, not passive |
| External API key exposure to client | ❌ (by design) | WaveSpeed key never leaves the server |
| Multi-tenant / public SaaS | ❌ | single internal team tool, fixed roster |
| Automated content moderation | ❌ | not present — review is manual only |
| Permanent asset storage guarantee | ⚠️ known gap | generated URLs can expire, no re-upload-to-S3 step yet |

## 6. Known limitations (as of 2026-09-13)

- Stylized outputs are stored as links to the generation provider's CDN, not re-uploaded to owned storage — some are already broken (tracked via the media-health tool, not yet fixed at the root).
- Free-tier Supabase auto-pause is a recurring operational risk, currently mitigated (keepalive ping) rather than eliminated (would need a paid plan).
- Several sync commands (`sync_sheets`, `sync_censo_csv`, `sync_registro`, `fill_estado_censo`) exist because the DB and legacy Google Sheets/Excel sources can drift — there is no single always-current source of truth yet.
