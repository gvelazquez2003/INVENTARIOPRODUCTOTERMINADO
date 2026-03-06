```javascript
const SPREADSHEET_ID = '1Ew0_W2D7RCCkz4n_JFfV2Q9xbOyIv3FDhTa1XP29Hq4';

const SHEET_NAMES = {
  inventario: 'INV_PROD_TERMINADO',
  getProducts: 'PRODUCTOS',
};

function getSheet(sheetName) {
  return SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(sheetName);
}

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || '{}');
  const { action, data } = payload;
  const sheet = SHEET_NAMES[action];
  if (!sheet) {
    return jsonResponse({ message: `Acción desconocida: ${action}` }, 400);
  }

  switch (action) {
    case 'inventario': {
      const productos = parseProductos(data.productos);
      if (!productos.length) {
        return jsonResponse({ message: 'Sin productos para registrar.' }, 400);
      }

      productos.forEach((item) => {
        appendRow(sheet, [
          data.hora || '',
          data.fecha || '',
          data.tipo || '',
          data.sede || '',
          data.empresa || '',
          item.codigo || '',
          item.descripcion || '',
          item.unidad || '',
          item.cantidad || '',
          data.responsable || '',
        ]);
      });
      break;
    }
  }

  return jsonResponse({ message: 'Datos guardados correctamente' });
}

function doGet(e) {
  if (e.parameter.action === 'getProducts') {
    const rows = getSheetValues(SHEET_NAMES.getProducts);
    const records = rows.map(([codigo, descripcion, unidad]) => ({ codigo, descripcion, unidad }));
    return jsonResponse({ records });
  }
  return jsonResponse({ message: 'OK' });
}

function appendRow(sheetName, values) {
  const sheet = getSheet(sheetName);
  sheet.appendRow(values);
}

function getSheetValues(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return [];
  }
  const range = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
  return range.getValues().filter((row) => row.some((cell) => cell !== ''));
}

function parseProductos(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function jsonResponse(body) {
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
```