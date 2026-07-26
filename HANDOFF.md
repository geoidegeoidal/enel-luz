# HANDOFF.md — Última sesión / handoff entre sesiones

> **Convención**: este archivo es el puente entre sesiones de opencode.
> Al final de cada sesión de trabajo, el agente (o el usuario a mano) actualiza
> las secciones abajo. Al iniciar la próxima sesión, opencode lee este archivo
> **antes** de tocar código, y sabe exactamente dónde se quedó.
>
> Reglas:
> - Mantener orden cronológico inverso (la sesión más reciente arriba).
> - Borrar entradas mayores a ~10 sesiones. Una vez consolidadas las decisiones
>   clave, pasan a `AGENTS.md` si son permanentes, o se eliminan.
> - No reemplaza a `AGENTS.md`: AGENTS es contexto permanente del proyecto
>   (decisiones, trampas resueltas); HANDOFF es estado puntual de la(s) última(s)
>   sesión(es).

---

## Sesión actual / próxima

**Estado**: el reporte operativo RM/comuna exportable a PDF quedó validado y su
publicación directa en `main` fue autorizada por el usuario. El lenguaje visual se
guardó en `.interface-design/system.md`. La plantilla usa dos páginas A4
apaisadas, mapa SVG operacional, KPIs, indicadores, reloj ±12 h, escala ETA,
tablas de prioridad, timestamp, frescura y nota metodológica. Tras feedback del
usuario se elevó la escala tipográfica y el mapa ahora superpone incidencias
activas como rombos naranjas y avisos como puntos cian, con leyenda cuantificada.
Posteriormente se agrego localmente una guia persistente para explicar los seis
indicadores operativos del dashboard. El README tambien fue reconstruido como
portada editorial del centro de mando, con capturas reales actuales, definiciones
de indicadores y dos diagramas Mermaid de arquitectura. Estos ajustes aun no
tienen commit.

Durante la revisión PDF se detectó que Enel puede publicar varias geometrías con
el mismo nombre de comuna (caso COLINA). El cross-filter, los KPIs, el ranking y
el reporte ahora combinan todas las geometrías, suman clientes afectados y usan
`CLIENTESTOTAL` una sola vez.

**Validación final**: Vitest 17/17, `tsc --noEmit`, build Vite y smoke E2E con
reportes RM/comuna. Se generaron y revisaron visualmente cuatro páginas reales:
`output/pdf/enel-luz-reporte-rm.pdf` y
`output/pdf/enel-luz-reporte-colina.pdf`; ambos tienen 2 páginas A4 apaisadas
sin recortes ni solapamientos.

**Próximo paso al retomar**: revisar y, si el usuario lo solicita, publicar la
guia de indicadores junto con el nuevo README y sus assets. La recomendación
para el aviso Node 20 de Actions es
actualizar `checkout`/`setup-node` y el build a Node 24 en un cambio separado;
mantener las majors oficiales actuales de las actions de Pages hasta que GitHub
publique reemplazos Node 24. No se modificó el workflow en esta sesión.

---

## Historial de sesiones

### 2026-07-26 — README editorial y arquitectura visual

**Objetivo**: reemplazar la documentacion generica por una entrada coherente con
el centro de mando y util para lectores operativos y tecnicos.

**Hecho**:
- Cabecera SVG propia con la reticula y paleta ENEL·LUZ.
- Narrativa organizada en ocho modulos numerados: proposito, vistas,
  arquitectura, integridad, tecnologia, desarrollo, publicacion y licencia.
- Capturas reales del mapa, indicadores con guia, graficos, diagnostico y
  primera pagina del reporte.
- Diagramas Mermaid del pipeline Enel -> espejo -> Pages y del flujo interno
  loader -> modelo -> store -> alcance -> visualizaciones/reporte.
- Script `scripts/readme-shots.mjs` para regenerar los assets sin mockups.

**Validacion**:
- SVG parseado como XML valido; rutas y assets del README verificados.
- Build Vite y smoke E2E: OK.
- Capturas de indicadores y reporte inspeccionadas visualmente.

### 2026-07-26 — Guia de indicadores operativos

**Objetivo**: eliminar la ambiguedad de la matriz operacional del dashboard.

**Hecho**:
- Encabezado propio y guia siempre visible para los seis indicadores.
- Definiciones de ventana temporal, signo, percentiles, ETA y eventos sin ETA.
- Nota metodologica sobre alcance activo y deduplicacion por ID.
- Reticula 2 x 3 en escritorio y una columna en mobile, sin tooltips obligatorios.

**Validacion**:
- Vitest 17/17, `tsc --noEmit`, build Vite y smoke E2E: OK.
- Revision visual local en escritorio y mobile: seis definiciones legibles y
  sin recortes; la reticula mobile resolvio una columna de 346 px.

### 2026-07-26 — Legibilidad y mapa operacional del reporte

**Objetivo**: corregir la tipografía demasiado pequeña y convertir el mapa
coroplético en una vista útil para diagnóstico.

**Hecho**:
- Cuerpo, tablas, metadatos y etiquetas SVG aumentados manteniendo la retícula.
- Incidencias activas deduplicadas representadas con contorno y rombo naranja.
- Avisos individuales representados como puntos cian con borde blanco.
- Leyenda territorial separa severidad, incidencias y avisos con conteos.
- El patrón quedó persistido en `.interface-design/system.md`.

**Validación**:
- Vitest 17/17, `tsc --noEmit`, build Vite y smoke E2E: OK.
- PDF RM y COLINA regenerados; sus cuatro páginas finales fueron renderizadas a
  PNG e inspeccionadas sin recortes, solapamientos ni texto ilegible.

### 2026-07-26 — Sistema visual + reporte PDF RM/comuna

**Objetivo**: persistir el lenguaje visual y crear un reporte regional o comunal
exportable a PDF, cuidando diseño, semántica y fidelidad de datos.

**Hecho**:
- Sistema visual documentado con dirección, tokens, retícula, profundidad,
  patrones de dashboard/reporte y controles de calidad.
- Botón `REPORTE PDF` integrado al alcance operativo; usa RM, comuna o área
  dibujada activa sin backend.
- Vista previa accesible con dos páginas A4 apaisadas y acción
  `IMPRIMIR / GUARDAR PDF`.
- Primera página: identidad, metadatos, KPIs, mapa vectorial de severidad,
  lectura ejecutiva e indicadores operativos.
- Segunda página: reloj centrado en AHORA, escala ETA, eventos prioritarios,
  comunas con mayor impacto y metodología.
- Script reproducible `scripts/report-pdf.mjs` para generar muestras con Chrome.
- Comunas multi-geometría agregadas correctamente en mapa, filtros, KPIs,
  gráfico de impacto y reporte.

**Validación**:
- `npm test`: 5 archivos, 17/17 pruebas OK.
- `tsc --noEmit`: OK.
- `npm run build`: OK.
- Smoke E2E: reporte RM y comunal, dos páginas, mapa SVG y acción PDF OK.
- PDF RM y COLINA reabiertos, validados como 2 páginas 841.9 x 595 pt y
  renderizados a PNG para inspección visual.

**Cambios de repo**:
- Cambios locales pendientes sin commit.
- `output/` y `tmp/` ignorados; muestras PDF se conservan localmente para
  entrega, no para versionado.
- `assets/mobile_*.png` y `preview-err.log` permanecen intactos.

### 2026-07-26 — Inteligencia operacional + cross-filter

**Objetivo**: elevar la visualización de datos sin romper la dirección visual
flat tipo panel de instrumentos suizo y publicar el resultado.

**Hecho**:
- Seleccionar una comuna o dibujar un polígono filtra de forma coherente mapa,
  clusters, hexbin, KPIs y los cuatro gráficos; el alcance siempre queda visible
  y puede volver a toda la RM con un control dedicado.
- Nuevo panorama operacional con presión de 60 minutos, cambio contra la hora
  anterior, edades P50/P90, ETA vencidas y eventos sin ETA.
- Gráfico firma “Reloj operativo · ±12 h” centrado en AHORA y escala de
  reposición ordenada por urgencia; ranking e impacto comunal conservados.
- KPIs corregidos para distinguir incidencias activas únicas, descargos únicos y
  conteos de polígonos de las capas.
- Fechas Enel interpretadas explícitamente en `America/Santiago`; gráficos
  temporales actualizados por minuto sin depender de una descarga nueva.
- Buscador RM, geoprocesos deduplicados, tema dinámico y documentación previa
  integrados en el mismo paquete.
- Capturas `final_initial.png`, `final_charts.png` y `final_diag.png`
  regeneradas con datos reales.

**Validación**:
- `npm test`: 4 archivos, 11/11 pruebas OK.
- `tsc --noEmit`: OK.
- `npm run build`: OK.
- Smoke E2E de producción local: OK, incluido filtro por comuna y retorno a RM.
- Revisión independiente: todos los hallazgos críticos e importantes
  incorporados; sin bloqueantes restantes.

**Cambios de repo**:
- Publicación directa en `main` solicitada por el usuario; el deploy se realiza
  mediante `.github/workflows/deploy.yml`.
- `assets/mobile_*.png` y `preview-err.log` permanecen fuera de versión.

### 2026-07-26 — Correcciones de revisión + cobertura de regresión

**Objetivo**: corregir todos los hallazgos funcionales de la revisión integral
y proponer el siguiente salto de calidad para la visualización de datos sin
alterar la dirección visual plana tipo panel de instrumentos suizo.

**Hecho**:
- Buscador restringido a la RM tanto en Photon/Nominatim como en validación
  cliente; resultados construidos con DOM seguro para evitar inyección HTML.
- Deduplicación de incidencias aplicada también al diagnóstico de dirección y
  al radio de 500 m; `CLITOTAL` ya no se infla por polígonos repetidos.
- El filtro espacial reemplaza la fuente de avisos visible, por lo que clusters
  y etiquetas se recalculan sólo con los puntos filtrados.
- Gráficos pueden renderizar antes que el mapa y sus colores de ejes/tooltips
  se recalculan con la paleta activa al cambiar de tema.
- README, footer y AGENTS alineados con el deploy real y el carácter
  best-effort del cron.
- Añadido Vitest con 6 pruebas de regresión para búsqueda RM, deduplicación,
  radio, diagnóstico y filtrado/reclustering.
- Smoke E2E endurecido con geocoder simulado, resultado malicioso controlado y
  aserciones reales para búsqueda, XSS, mapa, radio, incidencia cercana,
  hexbin y tema.
- Revisión independiente sin bloqueantes; sus observaciones sobre IDs
  alternativos, restablecimiento del clúster y determinismo del smoke quedaron
  incorporadas.

**Validación**:
- `npm test`: 3 archivos, 6/6 pruebas OK.
- `tsc --noEmit`: OK.
- `npm run build`: OK.
- `node scripts/smoke.mjs http://127.0.0.1:43129/ ...`: OK.
- `git diff --check`: OK (sólo avisos de conversión LF/CRLF de Git).

**Cambios de repo**:
- Cambios pendientes sin commit en código, tests, documentación y lockfile.
- No se hizo commit, push ni deploy.
- No se tocaron `assets/mobile_*.png` ni `preview-err.log`.

### 2026-07-26 — Revisión integral + conexión GitHub verificada

**Objetivo**: revisar el proyecto completo, explicar su arquitectura y dejar
GitHub disponible para controlar los repositorios del usuario.

**Hecho**:
- Recorrido completo de código, estilos, datos, scripts y workflows.
- Dependencias instaladas localmente; `npm run build` y `tsc --noEmit` OK.
- Smoke E2E con Chrome OK: mapa, gráficos, búsqueda, radio, incidencia cercana
  y hexbin renderizan; captura generada correctamente.
- Producción verificada: Pages respondió con `datos: "26/07 04:24"`.
- Actions verificado: el run `30194732878` actualizó datos a `b95b2b3`, construyó
  el artefacto desde ese commit y desplegó Pages con éxito.
- Plugin/conector GitHub ya estaba instalado y conectado como `geoidegeoidal`;
  acceso a `geoidegeoidal/enel-luz` confirmado con permisos admin/maintain/
  pull/push/triage. GitHub CLI también está autenticado con scopes
  `repo` y `workflow`.

**Hallazgos pendientes (no corregidos en esta sesión)**:
1. `src/geo/search.ts`: `RM_BBOX` está declarado pero no se envía a Photon. El
   smoke de “Apoquindo 4500” seleccionó “Apoquindo, La Unión” y sacó el mapa de
   la RM.
2. `src/geo/analysis.ts:125-136`: `bufferStats()` cuenta polígonos, no eventos,
   y suma `CLITOTAL` sin deduplicar por `INCIDENCIA`; reintroduce la inflación
   que KPIs y ranking ya evitan.
3. `src/map/layers.ts:328-332`: el filtro espacial de avisos solo se aplica a
   `avisosPoints`; clusters y sus etiquetas siguen agregando todos los avisos.
4. `src/main.ts:283-288`: `refreshViews()` retorna si el mapa aún no existe,
   por lo que contradice el comentario de renderizar gráficos antes de tiles.
5. `src/charts/charts.ts:30-41`: estilos base de ejes/tooltips capturan la
   paleta clara al importar; el cambio a dark mode no recalcula todos esos
   colores.
6. `README.md:69` afirma que los commits de datos no disparan rebuild, pero el
   workflow actual llama explícitamente a `deploy.yml` cuando cambian datos.
7. El cron declara `*/5`, pero los runs observados se ejecutan aproximadamente
   cada hora por la naturaleza best-effort de GitHub Actions; no garantiza
   frescura real de cinco minutos.

**Cambios de repo**:
- Solo esta actualización de `HANDOFF.md`.
- No se modificó código de producto ni se tocaron los archivos no versionados
  existentes (`assets/mobile_*.png`, `preview-err.log`).

### 2026-07-20 — Auto-refresh elegante con pausa en background + freshness badge

**Objetivo**: eliminar la necesidad de que el usuario refresque a mano para ver datos actualizados.

**Hecho**:
- Refactor de la sección "Auto-refresh" en `src/main.ts:290-371`:
  - `tickRefresh({manual})` reporta errores (`pollErrors++` → toast a partir de 3 fallos seguidos), feedback positivo en refresh manual ("Datos ya están al día"),estado visible del botón (loading spinner via `.loading`, success verde 1.5s).
  - `fmtFreshness(diffMs)`: "hace 23s" / "hace 5m 04s" / "hace 2h 15m" — swiss, mono, discreto.
  - `updateFreshness()`: pinta `#datos-freshness` cada 1s; verde si <2min (`fresh`), ámbar si >7min (`stale`).
  - `startPolling()` / `stopPolling()`: separa el `setInterval` para pausar/reanudar. Pausa el countdown cuando `document.hidden`.
  - `visibilitychange` listener: al volver al tab, refresh inmediato si hace >5s del último poll; reanuda reloj y freshness.
  - Botón `#refresh-now` en masthead (SVG circular arrow, 34px, mismo estilo que `#theme-toggle`) — click → `tickRefresh({manual:true})`. Spin CSS en `.loading`, borde verde en `.success`.
  - Refresh del `applyNewData()` ahora también llama `updateFreshness()`.
  - Fix de yapa: agregado `import type { LegendMode }` en `src/main.ts:59` (TS error preexistente en línea 160).
- `index.html:30-38`: agregado `<button id="refresh-now">` con SVG y `<span id="datos-freshness">` en `.live-wrap`.
- `src/style.css:247-290`: estilos de `#refresh-now` (mismo token que `#theme-toggle`, borde 1px, hover invert), `@keyframes spin`, `.success` verde;`.live-freshness` mono 10.5px, `.fresh`/`.stale`.
- Smoke test OK (carga + search + radio + hexbin + hover + nearest). Build OK. Typecheck OK.

**Decidido**:
- **Sin WebSocket/SSE**: GitHub Pages es estático; agregar backend (CF Worker/Worker+Durable) implica exponer datos a otra infra y rompe el 100% client-side. Polling cada 60s es suficiente (Enel republica cada ~5 min).
- **Pausar polling en background** (`document.hidden`): ahorra battery + requests inútiles a Pages, pero el reloj sigue andando para no romper la sensación de "live".
- **Refresh on-visibilidad**: si el usuario vuelve al tab después de 10 min, se actualiza al instante sin esperar al próximo tick (la causa #1 de "tengo que apretar F5").
- **Freshness badge en lugar de más toasts**: feedback continuo, sutil, sin interrumpir. Verde (<2min) / gris neutro / ámbar (>7min) — mismo token de severidad que el resto del sitio.
- **Toast más expresativo en update real**: "Datos actualizados ✓ — DD/MM HH:mm" en vez de solo timestamp.
- **No sonidos**: rompen flujo de análisis.
- **Errores dejan de ser silenciosos**: a partir de 3 fallos seguidos, toast "Sin conexión al espejo (N intentos fallidos)". El usuario sabe que no está viendo datos frescos por una razón, no porque se olvidó de F5.

**Bloqueantes / pendientes**:
- Ninguno. Smoke test pasó limpio. Errores en log del smoke son tiles OpenFreeMap intermitentes (preexistente, no relacionado).

**Próxima sesión**:
- Sanity check en producción (https://geoidegeoidal.github.io/enel-luz/) post-deploy: verificar que el badge "hace Xs" arranque verde, que el spin del botón funcione, y que volviendo de un tab inactivo >10min se dispare el refresh solo.
- Si se observa que el toast de "actualizado" es molesto en sesiones largas con updates cada 5min, considerar bajarlo a solo flash de la barra + badge verde (sin toast).

**Commits relevantes**: pendiente commit (usuario no pidió commit explícito). Cambios en `index.html`, `src/style.css`, `src/main.ts`.

### 2026-07-19 — Build completo + mobile + fixes de UI + deduplicación incidencias

**Objetivo**: construir el visor ENEL·LUZ end-to-end y dejarlo deployado en
GitHub Pages.

**Hecho** (commits no-data, orden cronológico ascendente):
- `26cc97d` Initial commit (esqueleto Vite + TS + MapLibre basemap)
- `dd95d5f` UI: colored analysis tools and new search button
- `4b56e1c` docs: update README with screenshots and features
- `ef8d5c1` fix: add missing glyphs to satellite style
- `524dec2` feat: align chart severity colors with map and add inline legend
- `84fd7d4` fix: trigger deploy on data commits to update github pages
- `c1b9679` docs: update AGENTS.md with github pages deployment catch
- `8f8c254` feat: responsive mobile layout
- `c209e06` chore: add mobile screenshot script
- `ad0b0a5` fix: mobile scroll and auto-collapse toolbar
- `bf0a5c1` fix: prevent toolbar from overlapping map legend on mobile
- `4b19c59` fix: raise toolbar z-index above map legend
- `cb80447` fix: trigger deploy workflow on data update
- `5173154` fix: deduplicate incidencias logic to prevent massive data inflation
- `7ba32cf` feat: add subtle layer descriptions to toolbar
- `70d707f` fix: stack legends when both comunas and densidad are active

**Decidido**:
- Stack visual: flat design suizo, paper+tinta, sin gradientes/sombras. UI
  clara (light/dark mode), mapa como viewport oscuro. Estética "AI slop"
  genérica explícitamente rechazada.
- Espejo de datos con GitHub Actions (cron `*/5 * * * *`) en vez de proxy
  server propio: Enel no manda CORS, los JSON planos se espejan a
  `public/data/` y cada commit re-dispara deploy a Pages.
- Bug crítico de `INCIDENCIA` resuelto: no sumar `CLITOTAL` entre trafos
  del mismo evento (ya trae el total). Ver `AGENTS.md` § Trampa 5.
- GitHub Pages con Vite **requiere rebuild completo** en cada commit de
  datos: el action `deploy-pages` sirve solo `dist/`, no JSON sueltos. Ver
  `AGENTS.md` § Trampa 9.
- Sin alimentadores: la capa remota casi siempre da 404, código tolera null.
- Sin snapshots históricos: decidido no implementar para repo liviano.

**Bloqueantes / pendientes**:
- Ninguno activo. El visor está deployado y los updates de datos corren
  cada 5 min automáticamente.

**Próxima sesión**:
- Sanity check del deploy de Pages.
- Si hay feedback de uso, considerar: web workers para parse de avisos
  (si el GeoJSON de ~2.2 MB empieza a doler en mobile), service worker
  offline, o mejor manejo de `alimentadores` si Enel los vuelve a servir.

**Commits relevantes**: todos los listados arriba; el más reciente
no-data es `70d707f` (2026-07-19).
