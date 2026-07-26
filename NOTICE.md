# LUZ·RM — Avisos de derechos, fuentes y atribuciones

Última revisión: 26 de julio de 2026.

Este documento separa los componentes propios de LUZ·RM de los datos,
servicios, marcas, mapas, tipografías y bibliotecas pertenecientes a terceros.
No sustituye los términos de cada proveedor.

## 1. Código y recursos propios

El código fuente, la documentación textual y los recursos gráficos originales
de este repositorio se distribuyen bajo la licencia [MIT](LICENSE), salvo
elementos o contenido de terceros identificados en este aviso:

```text
Copyright (c) 2026 geoidegeoidal
```

La licencia MIT se aplica únicamente a los materiales sobre los que el titular
del repositorio tiene derechos suficientes. No transfiere ni relicencia
materiales de terceros.

## 2. Identidad y marcas

**LUZ·RM** es la identidad independiente utilizada por este proyecto.

“Enel” y cualquier otra denominación, marca, logotipo o identidad de Enel
pertenecen a sus respectivos titulares. Su mención en este proyecto se limita a
identificar la procedencia de datos operativos. Este proyecto no está
patrocinado, aprobado, operado ni afiliado con Enel.

No se distribuyen logotipos oficiales de Enel como parte de la identidad de
LUZ·RM.

## 3. Datos operativos

La aplicación consume copias de archivos GeoJSON publicados por
`mapaemergencia.enel.com`. Estos datos:

- no están cubiertos por la licencia MIT del código;
- conservan los derechos y condiciones que correspondan a su fuente;
- se presentan sin garantía de integridad, actualidad o continuidad;
- constituyen un snapshot operativo y no una confirmación oficial de
  reposición, afectación contractual o calidad de servicio.

Quien redistribuya o reutilice los datos es responsable de verificar los
términos aplicables de la fuente.

## 4. Cartografía y servicios geográficos

- **OpenStreetMap**: datos © OpenStreetMap contributors, disponibles bajo
  Open Data Commons Open Database License (ODbL).
  <https://www.openstreetmap.org/copyright>
- **OpenMapTiles**: esquema y diseño cartográfico con sus licencias BSD
  3-Clause y CC BY 4.0, incluida su obligación de atribución.
  <https://github.com/openmaptiles/openmaptiles/blob/master/LICENSE.md>
- **OpenFreeMap**: servicio de teselas utilizado por los mapas vectoriales.
  La atribución mostrada en el mapa sigue su guía de integración.
  <https://openfreemap.org/quick_start/>
- **Esri World Imagery**: imágenes y referencias sujetas a las condiciones y
  atribuciones de Esri. <https://www.esri.com/legal/>
- **Photon**: geocodificador basado en datos de OpenStreetMap, distribuido por
  su proyecto bajo Apache License 2.0.
  <https://github.com/komoot/photon>
- **Nominatim**: proveedor de geocodificación alternativo, sujeto a la política
  de uso de OpenStreetMap Foundation.
  <https://operations.osmfoundation.org/policies/nominatim/>

Las atribuciones visibles dentro del mapa y del reporte deben conservarse.

## 5. Tipografías y bibliotecas

Las familias **IBM Plex Sans** e **IBM Plex Mono** se distribuyen mediante
Fontsource bajo SIL Open Font License 1.1.

Dependencias directas principales:

| Componente | Licencia declarada |
|---|---|
| MapLibre GL JS | BSD-3-Clause |
| Apache ECharts | Apache-2.0 |
| Turf.js | MIT |
| IBM Plex Sans / Mono | OFL-1.1 |
| Vite | MIT |
| TypeScript | Apache-2.0 |
| Vitest | MIT |
| Puppeteer Core | Apache-2.0 |

Las versiones exactas y dependencias transitivas están registradas en
`package-lock.json`. Cada componente conserva su licencia y avisos originales.

## 6. Ausencia de garantía

LUZ·RM es una herramienta informativa y experimental. No reemplaza canales
oficiales, comunicaciones de emergencia, obligaciones regulatorias ni
información contractual del proveedor eléctrico.

Para decisiones que afecten seguridad, continuidad de servicio o derechos de
terceros, se deben consultar las fuentes oficiales correspondientes.

## 7. Registro facultativo en Chile

Este proyecto no declara contar con una inscripción o certificado de propiedad
intelectual. En Chile, la protección por derecho de autor nace con la creación;
la inscripción ante el Departamento de Derechos Intelectuales es facultativa y
puede servir como antecedente probatorio.

Si el titular decide registrar el software, el DDI informa que normalmente debe
acompañar el código fuente, un manual de funcionamiento, las licencias de
software de terceros y una declaración que identifique a quienes participaron
en la creación cuando autor y titular no coinciden.

- Preguntas frecuentes del DDI:
  <https://www.propiedadintelectual.gob.cl/faq>
- Inscripción de programas computacionales:
  <https://www.propiedadintelectual.gob.cl/node/1234>

La solicitud requiere datos personales y declaraciones del titular, por lo que
no puede ser presentada automáticamente por este repositorio.
