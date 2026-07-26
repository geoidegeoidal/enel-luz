# LUZ·RM - Sistema visual

## Direccion

Panel de instrumentos suizo para una persona que coordina o interpreta cortes
de energia con poco tiempo. Debe permitir responder, en este orden:

1. Cuanto impacto existe.
2. Donde se concentra.
3. Si la presion esta aumentando.
4. Que eventos tienen reposicion vencida o proxima.
5. Que tan frescos son los datos.

La interfaz se siente como papel tecnico, tinta y senaletica electrica alrededor
de un mapa nocturno. Es precisa, densa y sobria; nunca decorativa.

## Territorio visual

- Dominio: red electrica, centro de mando, corte, reposicion, comuna, aviso,
  incidencia, presion, tiempo operativo y frescura del dato.
- Mundo de color: papel marfil, tinta carbon, rojo de emergencia, ambar de
  precaucion, naranja de incidencia, verde de servicio y cian de telemetria.
- Firma: reloj operativo centrado en `AHORA`, con pasado a la izquierda y ETA a
  la derecha. Debe aparecer en dashboard y reportes.
- Rechazos permanentes:
  - Dashboard de tarjetas redondeadas -> bandas y celdas rectilineas.
  - Gradientes/heatmaps decorativos -> rellenos solidos por umbral semantico.
  - Sombras/elevacion flotante -> jerarquia por bordes, bloques y tipografia.

## Tokens

### Color

| Token | Valor | Uso |
|---|---:|---|
| `paper` | `#f2f0e9` | lienzo claro e impresion |
| `panel` | `#ffffff` | celdas y hojas de reporte |
| `ink` | `#141414` | texto, bordes y accion primaria |
| `ink-2` | `#6b6b63` | metadatos y texto secundario |
| `line-soft` | `#d8d5cb` | divisiones internas |
| `red` | `#e4002b` | emergencia, vencido, identidad |
| `amber` | `#e3a008` | precaucion y ETA proxima |
| `orange` | `#ea6a00` | incidencia confirmada |
| `green` | `#12a150` | servicio, ETA programada, baja severidad |
| `cyan` | `#00a0dc` | avisos, telemetria e informacion |
| `violet` | `#6c4fd8` | capa secundaria excepcional |

Escala de severidad comunal por porcentaje de clientes afectados:
`<5 verde`, `5-15 ambar`, `15-50 naranja`, `>=50 rojo`.

### Tipografia

- IBM Plex Sans: interfaz, titulos y lectura editorial.
- IBM Plex Mono: cifras, horas, IDs, etiquetas tecnicas y metadatos.
- Titulos de bloque: mayusculas, 10-12 px, 600-700, tracking 0.12-0.16 em.
- Datos principales: mono tabular, peso 600-700.
- Nunca depender solo del tamano: combinar peso, tracking, caja y color.

### Espaciado y forma

- Unidad base: 4 px.
- Escala preferida: 4, 8, 12, 16, 20, 24, 32.
- Radio: 0. Controles, paneles y hojas son rectilineos.
- Bordes: 1 px; 2 px solo para foco o separacion de maxima importancia.
- Foco: anillo de 2 px con offset de 2 px.

### Profundidad

Estrategia unica: bordes. No usar sombras, gradientes, biseles ni superficies
flotantes. El mapa es el unico campo oscuro persistente; las capas editoriales
se separan por papel/panel y lineas.

## Patrones reutilizables

### Masthead operativo

- Franja roja de 4 px.
- Banda carbon con marca, contexto, hora local, timestamp de datos y frescura.
- Controles rectangulares integrados en la misma altura.

### Banda KPI

- Seis celdas contiguas, sin gaps.
- Primer KPI en bloque rojo cuando representa impacto total.
- Numero mono dominante, etiqueta sans en mayusculas y contexto mono pequeno.
- Los conteos de eventos siempre son IDs deduplicados; los conteos de capa
  pueden ser poligonos y deben rotularse como tales.

### Alcance visible

- Todo analisis debe declarar `RM`, comuna o area dibujada.
- Mostrar en la misma pieza: comunas, eventos unicos y avisos incluidos.
- La accion de volver a RM es explicita.

### Indicadores operativos

- Matriz 3 x 2 en celdas compactas.
- Orden: presion 60m, cambio hora previa, edad P50, edad P90, ETA vencidas,
  eventos sin ETA.
- Debajo de la matriz, una guia siempre visible define los seis indicadores,
  explica el signo del cambio y aclara alcance y deduplicacion. No depender de
  tooltips para conceptos necesarios para interpretar el dato.
- Rojo implica accion/atraso; ambar implica vigilancia; cian telemetria; verde
  mejora o programacion saludable.

### Graficos

- Cuadricula tenue, ejes mono y leyendas integradas al titulo.
- Barras planas, sin esquinas redondeadas ni efectos.
- El reloj operativo conserva `AHORA` en el centro y una ventana simetrica.
- La escala de reposicion ordena vencidos, proximos y programados.
- Tooltips escapan datos externos y mantienen la misma jerarquia tipografica.

### Reporte PDF

- Dos paginas A4 apaisadas.
- Pagina 1: identidad, alcance/frescura, KPI, mapa de severidad e indicadores.
- Pagina 2: reloj operativo, escala de reposicion, impacto comunal, eventos
  prioritarios y nota metodologica.
- El mapa no puede ser solo coropletico: sobre la severidad comunal debe mostrar
  incidencias activas como rombos naranjas y avisos como puntos cian, siempre
  filtrados al alcance y con conteos en la leyenda.
- En impresion, cuerpo y datos secundarios usan 7.5 px o mas; solo metadatos de
  pie y metodo pueden bajar a 6.5-6.8 px. Graficos SVG usan etiquetas de 8.5 px
  o mas.
- Fondo blanco para impresion; tinta carbon y los mismos colores semanticos.
- Encabezado, pie, numero de pagina y aviso de proyecto no oficial obligatorios.
- Sin tarjetas flotantes: modulos editoriales unidos por una reticula de bordes.

### Documentacion GitHub

- El README funciona como portada editorial del centro de mando, no como lista
  de funcionalidades ni como pagina de marketing generica.
- Cabecera vectorial con franja roja, banda carbon, linea cian y seis modulos
  operativos; mantiene la firma visual aun dentro de las restricciones de
  GitHub Markdown.
- Orden narrativo: preguntas operativas, vistas reales, definiciones,
  arquitectura, reglas de integridad, tecnologia y puesta en marcha.
- Las capturas se regeneran desde produccion local con
  `scripts/readme-shots.mjs`; nunca documentar paneles con mockups.
- Diagramas Mermaid usan los mismos colores semanticos: carbon para nucleo,
  rojo para alcance/accion, cian para datos y verde para publicacion.

### Identidad y procedencia

- Marca publica: `LUZ·RM`. No usar nombres de proveedores de datos dentro del
  lockup, titulo del producto, metadatos sociales ni encabezado del reporte.
- `Enel Chile` aparece solo como procedencia del snapshot y nunca como aval,
  afiliacion, patrocinio o titular de la interfaz.
- Aviso corto obligatorio: `PROYECTO INDEPENDIENTE · ENEL SOLO IDENTIFICA LA
  FUENTE`.
- La identidad visual propia conserva el simbolo electrico geometrico, la
  reticula, el reloj `AHORA` y la paleta semantica.

## Movimiento y estados

- Animar solo `opacity` y `transform`, menos de 350 ms.
- Para impresion y `prefers-reduced-motion`, desactivar animaciones.
- Cada accion necesita hover, active, focus y disabled.
- Datos: contemplar carga, vacio, error y snapshot obsoleto.

## Verificacion

- Swap: Plex + reticula rectilinea + reloj `AHORA` deben ser reconocibles.
- Squint: impacto total, mapa y estado temporal dominan en ese orden.
- Firma presente en masthead, KPI, alcance, reloj, ETA y reporte.
- Ningun color o medida nueva fuera de tokens sin documentarla aqui.
