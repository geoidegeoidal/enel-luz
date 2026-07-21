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

**Estado**: el proyecto se construyó el 2026-07-19 en una sola jornada de
trabajo. Desde entonces solo recibe updates de datos automáticos (cron GitHub
Actions cada 5 min, ver `.github/workflows/update-data.yml`). Ultimo commit
no-data: `70d707f` (fix: stack legends when both comunas and densidad are
active). Ultimo commit data: `2efaee5` (manual update 23:59 mismo día.

**Próximo paso al retomar**: vericá `https://geoidegeoidal.github.io/enel-luz/`
que el deploy de Pages esté sincronizado con `main` (sanity check). Si todo
anda, no hay trabajo pendiente urgente; las ideas futuras están listadas en
`AGENTS.md` § "Pendientes / ideas futuras".

---

## Historial de sesiones

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