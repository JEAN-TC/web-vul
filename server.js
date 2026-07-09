const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

// Middleware para JSON y urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Base de datos Mock en memoria para componentes electrónicos y usuarios de Nexus Develop
const users = [
  { id: 1, username: 'admin', password: 'SuperSecureAdminPassword123!', role: 'lead_engineer', email: 'admin@nexus-develop.local', phone: '+1-800-NEXUS-01' },
  { id: 2, username: 'guest', password: 'password', role: 'guest_reviewer', email: 'guest@nexus-develop.local', phone: '+1-800-NEXUS-99' }
];

const products = [
  { id: 1, name: 'STM32F407VGT6', description: 'Microcontrolador ARM Cortex-M4 de 32 bits, 168 MHz, 1 MB de Flash, 192 KB de RAM, encapsulado LQFP-100.', price: '$12.45', category: 'Microcontroladores' },
  { id: 2, name: 'ESP32-WROOM-32E', description: 'Módulo transceptor Wi-Fi + BT + BLE MCU de alto rendimiento y bajo consumo de energía con antena integrada.', price: '$4.20', category: 'Inalámbrico' },
  { id: 3, name: 'LM2596S-ADJ', description: 'Regulador de conmutación reductor (Step-Down) ajustable de 3A, frecuencia de conmutación de 150 kHz, encapsulado TO-263.', price: '$1.85', category: 'Administración de Energía' },
  { id: 4, name: 'W25Q128JVSSIQ', description: 'Memoria Flash Serial SPI de 128 Mb (16 MB), frecuencia de hasta 133 MHz, encapsulado SOIC-8 de rango industrial.', price: '$2.15', category: 'Chips de Memoria' },
  { id: 5, name: 'MPU-6050', description: 'Unidad de procesamiento de movimiento (IMU) de 6 ejes con giroscopio y acelerómetro integrados, interfaz I2C.', price: '$3.50', category: 'Sensores' },
  { id: 6, name: 'SX1276IMLTRT', description: 'Transceptor RF LoRa de largo alcance y bajo consumo de energía, rango de frecuencia de 137 MHz a 1020 MHz.', price: '$5.80', category: 'Inalámbrico' }
];

let comments = [
  { author: 'Ing. Carlos Mendoza', content: 'He probado el módulo ESP32-WROOM en el diseño de la placa base V2. El acoplamiento de impedancia en la antena requiere un plano de tierra limpio.', date: '2026-07-08' },
  { author: 'Dra. Sofía Rivas', content: '¿Tienen los modelos 3D en formato STEP para el encapsulado LQFP-100 del STM32? Los necesito para la simulación mecánica de la carcasa.', date: '2026-07-09' }
];

const projects = [
  { id: 1, name: 'Satélite Experimental - Módulo de Control (Confidencial)', owner: 'admin', confidential: true, files: ['schematic_sat_rev3.sch', 'gerber_layers_v3.zip'], description: 'Diagrama esquemático confidencial de alta seguridad para el ordenador de a bordo del nanosatélite experimental.' },
  { id: 2, name: 'Placa de Desarrollo IoT Educativa (Pública)', owner: 'guest', confidential: false, files: ['layout_public_iot.brd'], description: 'Placa de expansión genérica y de código abierto para prácticas estudiantiles con sensores de temperatura e I2C.' }
];

// Helper para guardar logs de seguridad
function writeSecurityLog(type, details) {
  const timestamp = new Date().toISOString();
  // Vulnerabilidad A09:2021-Security Logging failures (Permite Log Injection al no sanitizar saltos de línea)
  const detailsString = JSON.stringify(details);
  const logMessage = `[${timestamp}] [ALERT] [TYPE: ${type}] - ${detailsString}\n`;
  
  // Imprimir en consola
  console.log(`\x1b[31m${logMessage.trim()}\x1b[0m`);
  
  // Guardar en fichero local
  const logPath = path.join(__dirname, 'security_alerts.log');
  fs.appendFileSync(logPath, logMessage);
}

// ==========================================================
// A01:2021-Broken Access Control (IDOR & LFI)
// ==========================================================

// IDOR: Leer detalles de proyecto confidencial por ID sin validación de sesión
app.get('/api/projects/:id', (req, res) => {
  const projectId = parseInt(req.params.id);
  const project = projects.find(p => p.id === projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Proyecto no encontrado' });
  }

  // Vulnerabilidad de Control de Acceso: Se responde con información confidencial de cualquier ID
  if (project.confidential) {
    writeSecurityLog('INSECURE_DIRECT_OBJECT_REFERENCE', {
      requestedId: projectId,
      projectName: project.name,
      owner: project.owner,
      requestedBy: req.query.user || 'anonymous'
    });
  }

  res.json(project);
});

// LFI: Inclusión local de ficheros por parámetro sin sanitización de ruta
app.get('/api/download', (req, res) => {
  const fileName = req.query.file;
  if (!fileName) {
    return res.status(400).send('Falta parámetro ?file=');
  }

  const baseDirectory = path.join(__dirname, 'manuals');
  const filePath = path.join(baseDirectory, fileName);

  if (fileName.includes('..')) {
    writeSecurityLog('PATH_TRAVERSAL_LFI', {
      requestedFile: fileName,
      resolvedPath: filePath,
      location: 'download-datasheet'
    });
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(404).send(`<h3>Error 404: Archivo no encontrado</h3><p>${err.message}</p>`);
    }
    res.setHeader('Content-Type', 'text/plain');
    res.send(data);
  });
});


// ==========================================================
// A03:2021-Injection (SQLi & Command Injection & XSS)
// ==========================================================

// SQLi Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Falta usuario o contraseña' });
  }

  const rawQuery = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
  
  // Vulnerabilidad A09: Log Injection. Guardamos directamente el string de username en el log sin limpiar
  writeSecurityLog('AUTHENTICATION_ATTEMPT', {
    usernameInput: username, // Si el usuario inyecta \n[ALERT]..., alterará el log de auditoría
    rawQuery
  });

  const isSqli = (str) => {
    const sqliPatterns = [/'\s*or\s*/i, /"\s*or\s*/i, /union\s+select/i, /--/, /#/];
    return sqliPatterns.some(pattern => pattern.test(str));
  };

  const detectedSqli = isSqli(username) || isSqli(password);
  
  if (detectedSqli) {
    writeSecurityLog('SQL_INJECTION_LOGIN', {
      username,
      password,
      query: rawQuery
    });

    return res.json({
      success: true,
      message: 'Autenticación del Workspace bypassada mediante inyección de código SQL.',
      user: users[0],
      query: rawQuery,
      injected: true
    });
  }

  const user = users.find(u => u.username === username && u.password === password);
  if (user) {
    return res.json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      user: { id: user.id, username: user.username, role: user.role, email: user.email },
      query: rawQuery,
      injected: false
    });
  }

  res.status(401).json({
    success: false,
    message: 'Credenciales inválidas.',
    query: rawQuery,
    injected: false
  });
});

// SQLi Búsqueda / UNION
app.get('/api/products', (req, res) => {
  const query = req.query.search || '';
  const rawQuery = `SELECT * FROM components WHERE name LIKE '%${query}%'`;

  if (query.toLowerCase().includes('union') && (query.toLowerCase().includes('select') || query.toLowerCase().includes('all'))) {
    writeSecurityLog('SQL_INJECTION_UNION', {
      searchQuery: query,
      query: rawQuery
    });

    const results = products.map(p => ({ ...p }));
    users.forEach(u => {
      results.push({
        id: `EXFIL_${u.id}`,
        name: `[EXFIL] Ingeniero: ${u.username}`,
        description: `Clave: "${u.password}" | Email: "${u.email}" | Tel: "${u.phone}"`,
        price: '$0.00',
        category: 'Datos del Personal'
      });
    });

    return res.json({ results, query: rawQuery, injected: true });
  }

  const results = products.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.description.toLowerCase().includes(query.toLowerCase())
  );

  res.json({ results, query: rawQuery, injected: false });
});

// Stored XSS Notas de Diseño
app.get('/api/comments', (req, res) => {
  res.json(comments);
});

app.post('/api/comments', (req, res) => {
  const { author, content } = req.body;
  if (!author || !content) {
    return res.status(400).json({ error: 'Falta autor o contenido' });
  }

  const xssPattern = /<script|onerror|onload|javascript:|eval\(/i;
  if (xssPattern.test(content) || xssPattern.test(author)) {
    writeSecurityLog('STORED_XSS_DETECTED', { author, content });
  }

  const newComment = {
    author,
    content,
    date: new Date().toISOString().split('T')[0]
  };
  comments.push(newComment);
  res.json({ success: true, comment: newComment });
});

// Command Injection
app.post('/api/diagnostics', (req, res) => {
  const { target } = req.body;
  if (!target) {
    return res.status(400).json({ error: 'Falta el host/IP del dispositivo' });
  }

  const command = `ping -c 2 ${target}`;

  const commandInjectionPattern = /[;|&&|\||`|\$]/;
  if (commandInjectionPattern.test(target)) {
    writeSecurityLog('COMMAND_INJECTION_ATTEMPT', { target, command });
  }

  exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
    res.json({
      command,
      stdout: stdout || '',
      stderr: stderr || '',
      error: error ? error.message : null
    });
  });
});


// ==========================================================
// A04:2021-Insecure Design (Price/Quantity Manipulation)
// ==========================================================
app.post('/api/checkout', (req, res) => {
  const { itemId, quantity, price } = req.body;
  
  const product = products.find(p => p.id === parseInt(itemId));
  if (!product) {
    return res.status(404).json({ error: 'Componente no encontrado' });
  }

  const qty = parseInt(quantity);
  const clientPrice = parseFloat(price);
  
  // Vulnerabilidad de Diseño Inseguro: Confiar en parámetros de precios y cantidades del cliente
  const total = qty * clientPrice;

  // Auditoría si detectamos discrepancia o cantidades maliciosas
  const actualPriceNum = parseFloat(product.price.replace('$', ''));
  if (qty <= 0 || clientPrice !== actualPriceNum) {
    writeSecurityLog('INSECURE_DESIGN_PRICE_MANIPULATION', {
      itemId,
      qty,
      clientPrice,
      actualPrice: product.price,
      totalCalculated: total
    });
  }

  res.json({
    success: true,
    message: 'Pedido de componentes verificado y procesado con éxito.',
    item: product.name,
    qty,
    total: `$${total.toFixed(2)}`
  });
});


// ==========================================================
// A05:2021-Security Misconfiguration (Directory Listing)
// ==========================================================

// Servidor de copias de seguridad de forma expuesta
app.get('/backups', (req, res) => {
  writeSecurityLog('SECURITY_MISCONFIGURATION_DIRECTORY_LISTING', {
    accessedPath: '/backups'
  });
  
  const backupDir = path.join(__dirname, 'backups');
  fs.readdir(backupDir, (err, files) => {
    if (err) {
      return res.status(500).send('Error leyendo directorio de backups.');
    }
    
    let html = '<html><head><title>Index of /backups</title></head><body style="background-color: #0b0f19; color: #e5e7eb; font-family: monospace; padding: 2rem;">';
    html += '<h2>Index of /backups</h2><hr style="border-color: #1e293b;"><ul>';
    files.forEach(file => {
      html += `<li><a href="/backups/${file}" style="color: #ff5a00; font-size: 1.1rem; line-height: 1.8;">${file}</a></li>`;
    });
    html += '</ul><hr style="border-color: #1e293b;"></body></html>';
    res.send(html);
  });
});

app.use('/backups', express.static(path.join(__dirname, 'backups')));


// ==========================================================
// A08:2021-Software and Data Integrity Failures (Insecure Deserialization)
// ==========================================================
app.post('/api/import-profile', (req, res) => {
  const { data } = req.body;
  if (!data) {
    return res.status(400).json({ error: 'Falta el payload de configuración' });
  }

  try {
    const decoded = Buffer.from(data, 'base64').toString('utf8');
    
    // Insecure Deserialization Vulnerability: Simulación mediante un parser peligroso (eval)
    // El formato de node-serialize es: _$$ND_FUNC$$_ seguido del código de la función
    if (decoded.includes('_$$ND_FUNC$$_')) {
      writeSecurityLog('INSECURE_DESERIALIZATION_RCE', {
        payload: decoded,
        status: 'Triggered simulated execution'
      });
      
      const funcBody = decoded.split('_$$ND_FUNC$$_')[1];
      // Vulnerabilidad crítica: Ejecución de código arbitrario al deserializar
      const result = eval(`(${funcBody})()`);
      return res.json({ success: true, message: 'Fichero de configuración parseado con éxito (Simulated RCE ejecutado).', result });
    }
    
    const obj = JSON.parse(decoded);
    res.json({ success: true, message: 'Fichero de configuración cargado.', profile: obj });
  } catch (err) {
    res.status(500).json({ error: `Fallo en el procesado de integridad: ${err.message}` });
  }
});


// ==========================================================
// A10:2021-Server-Side Request Forgery (SSRF)
// ==========================================================
app.get('/api/fetch-spec', (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send('Falta parámetro ?url=');
  }

  writeSecurityLog('SERVER_SIDE_REQUEST_FORGERY', {
    targetUrl: url,
    clientIp: req.ip
  });

  const client = url.startsWith('https') ? https : http;

  client.get(url, (response) => {
    let body = '';
    response.on('data', chunk => body += chunk);
    response.on('end', () => {
      res.send(body);
    });
  }).on('error', (err) => {
    res.status(500).send(`Error de SSRF al consultar endpoint externo: ${err.message}`);
  });
});

// ==========================================================
// INITIALIZATION AND SEED DATA
// ==========================================================
const manualsDir = path.join(__dirname, 'manuals');
if (!fs.existsSync(manualsDir)) fs.mkdirSync(manualsDir);

const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir);

// Escribir manuales de electrónica
fs.writeFileSync(path.join(manualsDir, 'stm32f407_datasheet.txt'), '=== STM32F407 DATASHEET ===\n\nMCU de 32 bits con núcleo Cortex-M4, FPU, acelerador ART.\nConfiguración de fábrica de bootloader en puerto USART1.\nClave de depuración interna: STM32-NEXUS-FIRM-9922\n');
fs.writeFileSync(path.join(manualsDir, 'esp32_hardware_reference.txt'), '=== ESP32 HARDWARE REFERENCE ===\n\nEspecificaciones de diseño para ESP32-WROOM-32E.\nImpedancia de antena: 50 ohms.\nClave AP local de depuración: ESP32_AP_DEBUG_KEY\n');

// Escribir copia de seguridad sensible (A02-Cryptographic Failures y A05-Security Misconfiguration)
const configBackup = {
  db_connection: 'mongodb://nexus_db_admin:UnsafePasswd9922!@localhost:27017/nexus_develop_prod',
  session_secret: 'NEXUS_SESSION_SECRET_KEY_883344',
  ms_graph_api_key: 'MS_GRAPH_API_DEVELOP_SECRET_XYZ_TOKEN',
  debug_mode: true
};
fs.writeFileSync(path.join(backupsDir, 'config_backup.json'), JSON.stringify(configBackup, null, 2));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n\x1b[32m[SERVER RUNNING]\x1b[0m Portal de Ingeniería Nexus Develop escuchando en http://127.0.0.1:${PORT}`);
  console.log(`\x1b[33m[SAFETY NOTE]\x1b[0m Servidor restringido a 127.0.0.1 (Localhost) por seguridad.\n`);
});
