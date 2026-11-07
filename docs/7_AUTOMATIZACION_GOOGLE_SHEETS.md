# 📊 Automatización de Pedidos en Google Sheets — Dolce 7 Aroma

**Ecosistema:** Cloudflare Workers + Google Apps Script + Google Drive  
**Propósito:** Vuelco automático de cada pedido generado en la web hacia una hoja de cálculo en tiempo real para control de inventario, logística de delivery y contabilidad comercial.

---

## 1. ¿Cómo Funciona la Integración?

Cada vez que un cliente finaliza una compra en [dolce7aroma.com](https://dolce7aroma.com) o en el catálogo:
1. El Worker guarda el pedido en la base de datos KV (\`ORDERS\`).
2. Envía la alerta inmediata por correo y Telegram.
3. Si está configurada la variable \`GOOGLE_SHEETS_WEBHOOK_URL\`, el Worker envía el pedido formateado a Google Sheets y lo inserta como una nueva fila en tu hoja de cálculo.
4. Si cambias el estado del pedido a \`pagado\`, \`en_camino\` o \`entregado\` desde el panel de administración, el Worker busca la fila correspondiente por su **ID de Pedido** y actualiza su estado automáticamente.

---

## 2. Guía de Instalación en 3 Minutos (Sin Costo y Sin Google Cloud)

### Paso 1: Crear la Hoja de Cálculo
1. Entra a tu Google Drive personal o del negocio ([drive.google.com](https://drive.google.com)).
2. Crea una nueva hoja de cálculo llamada:  
   **\`Pedidos - Dolce 7 Aroma\`**

---

### Paso 2: Pegar el Script Automatizador
1. Dentro de tu hoja de cálculo, ve al menú superior:  
   **Extensiones** ➡️ **Apps Script**.
2. Borra cualquier código de ejemplo que aparezca y pega este script completo:

\`\`\`javascript
/**
 * Dolce 7 Aroma — Receptor Automático de Pedidos Web
 * Se ejecuta al recibir peticiones POST desde Cloudflare Worker.
 */
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = JSON.parse(e.postData.contents);
    
    // Si la hoja es nueva o está vacía, generar cabeceras profesionales
    if (sheet.getLastRow() === 0) {
      const headers = [
        'ID Pedido', 'Fecha (Hora Perú)', 'Nombre Cliente', 'Teléfono / WhatsApp', 
        'Provincia', 'Distrito', 'Dirección', 'Referencia', 'Productos Solicitados', 
        'Total (S/)', 'Método Pago', 'Estado', '¿Regalo?', 'Origen de Visita'
      ];
      sheet.appendRow(headers);
      
      // Estilo visual corporativo (Fondo grafito y texto blanco)
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    const action = data.action || 'insert';
    
    // Si es actualización de estado (ej. cambio a 'pagado' o 'entregado')
    if (action === 'update') {
      const values = sheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === String(data.id).trim()) {
          const statusCell = sheet.getRange(i + 1, 12); // Columna L (Estado)
          statusCell.setValue(data.estado);
          return ContentService.createTextOutput(JSON.stringify({ 
            ok: true, action: 'updated', row: i + 1 
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
    }
    
    // Insertar nueva fila con el pedido
    const row = [
      data.id,
      data.fecha,
      data.nombre,
      "'" + String(data.telefono || ''), // Prefijo comilla para preservar números con cero inicial
      data.provincia || 'Lima',
      data.distrito,
      data.direccion,
      data.referencia || '',
      data.productos,
      Number(data.total || 0),
      data.metodoPago,
      data.estado,
      data.esRegalo,
      data.origen || 'directo'
    ];
    sheet.appendRow(row);
    
    return ContentService.createTextOutput(JSON.stringify({ 
      ok: true, action: 'inserted' 
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      ok: false, error: err.message 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
\`\`\`

---

### Paso 3: Publicar la Web App (Generar el Webhook)
1. En la esquina superior derecha de Apps Script, haz clic en el botón azul:  
   **Implementar** (o *Deploy*) ➡️ **Nueva implementación** (*New deployment*).
2. Haz clic en el engranaje ⚙️ a la izquierda y elige: **Aplicación web** (*Web app*).
3. Configura los campos:
   * **Descripción:** \`Receptor Pedidos Dolce 7 Aroma\`
   * **Ejecutar como:** **Yo** (\`tu-correo@gmail.com\`)
   * **Quién tiene acceso:** **Cualquier usuario** (*Anyone*) *(Es necesario para que Cloudflare Worker pueda enviar los datos).*
4. Haz clic en **Implementar**. Si te pide autorizar permisos con tu cuenta de Google, concédelos (*Avanzado ➡️ Ir a script sin título (no seguro)*).
5. Copia la **URL de la aplicación web**. Tendrá un formato como este:  
   \`https://script.google.com/macros/s/AKfycb.../exec\`

---

### Paso 4: Vincular en Cloudflare Workers
Tienes dos formas sencillas de conectarlo:

#### Opción A: Desde el Dashboard de Cloudflare (Recomendado)
1. Entra a [dash.cloudflare.com](https://dash.cloudflare.com) ➡️ **Workers & Pages**.
2. Selecciona tu Worker: **\`dolce7aroma-pedidos-bot\`**.
3. Ve a **Settings** ➡️ **Variables and Secrets**.
4. Añade un nuevo secreto:
   * **Nombre:** \`GOOGLE_SHEETS_WEBHOOK_URL\`
   * **Valor:** *(La URL larga que copiaste de Apps Script)*
5. *(Opcional)* Añade otra variable de texto plano:
   * **Nombre:** \`GOOGLE_SHEETS_URL\`
   * **Valor:** *(El enlace de tu hoja de Google Drive para abrirla con un clic desde Telegram).*

---

## 3. Comandos de Control en Telegram

Una vez configurado, tu bot de Telegram tendrá activo el comando:

* **\`/sheets\`** ➡️ Muestra el estado de la conexión y el enlace directo para abrir tu hoja de Google Sheets.
* **\`/sheets sync\`** ➡️ Lee todos los pedidos guardados históricamente en la base de datos KV de Cloudflare y los exporta a tu hoja de cálculo en Google Drive de una sola vez.
