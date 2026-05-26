# Carpeta de fotos de perfumes

Coloca aquí las fotos de tus perfumes (formato JPG, PNG o WebP).

## Cómo referenciarlas desde el Excel / CSV

En la columna `photo` del archivo de carga masiva, escribe **solo el nombre del archivo** que pusiste en esta carpeta. Ejemplos:

| photo (en el CSV)        | Imagen que debe existir aquí                  |
|--------------------------|-----------------------------------------------|
| `born-in-roma.jpg`       | `assets/perfumes/born-in-roma.jpg`            |
| `sauvage.jpg`            | `assets/perfumes/sauvage.jpg`                 |
| `coco-mademoiselle.jpg`  | `assets/perfumes/coco-mademoiselle.jpg`       |

El admin construye la ruta automáticamente como `assets/perfumes/<nombre>`.

## Recomendaciones

- **Tamaño:** mínimo 800×800 px, idealmente 1200×1200 px (las tarjetas son cuadradas).
- **Formato:** JPG para fotos, PNG si necesitas transparencia, WebP para mejor peso.
- **Nombre del archivo:** sin tildes ni espacios. Usa guiones: `lost-cherry.jpg`, no `Lost Cherry.jpg`.
- **Peso:** trata de que cada foto pese menos de 300 KB para que el sitio cargue rápido.
