// ==========================================================================
// NEXUS DEVELOP PORTAL - CLIENT SIDE JAVASCRIPT
// Handles DOM interactions, Altium-style Tabs, API routes and OWASP telemetry
// ==========================================================================

// Global state
let currentUser = { username: 'guest', role: 'guest_reviewer' };

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  searchProducts();
  loadComments();
});

// COLLAPSIBLE AUDIT PANEL CONTROLLER
function toggleAuditConsole() {
  const panel = document.getElementById('audit-panel');
  const icon = document.getElementById('audit-toggle-icon');
  
  panel.classList.toggle('expanded');
  
  if (panel.classList.contains('expanded')) {
    icon.className = 'fa-solid fa-chevron-down';
  } else {
    icon.className = 'fa-solid fa-chevron-up';
  }
}

// HORIZONTAL TAB SWITCHING SYSTEM
function switchTab(tabId) {
  const tabLinks = document.querySelectorAll('.sub-tab-link');
  tabLinks.forEach(link => link.classList.remove('active'));
  
  const activeTabLink = document.getElementById(`tab-${tabId}`);
  if (activeTabLink) activeTabLink.classList.add('active');

  const panels = document.querySelectorAll('.tab-panel');
  panels.forEach(panel => panel.classList.remove('active'));
  
  const activePanel = document.getElementById(`panel-${tabId}`);
  if (activePanel) activePanel.classList.add('active');
}

// =======================================================
// A03: INJECTION - PRODUCTS CATALOGUE & SQLi/XSS SEARCH
// =======================================================
function handleSearchKeyUp(event) {
  if (event.key === 'Enter') {
    searchProducts();
  }
}

function searchProducts() {
  const query = document.getElementById('search-input').value;
  const url = `/api/products?search=${encodeURIComponent(query)}`;
  
  fetch(url)
    .then(res => res.json())
    .then(data => {
      // Actualizar Consola de Auditoría SOC
      const queryTelemetryCode = document.getElementById('query-code-shop');
      const auditStatusBadge = document.getElementById('badge-sqli-shop');
      
      queryTelemetryCode.textContent = data.query;
      
      if (data.injected) {
        auditStatusBadge.textContent = 'SQLi UNION DETECTADA';
        auditStatusBadge.className = 'badge red-badge audit-status';
        
        const panel = document.getElementById('audit-panel');
        if (!panel.classList.contains('expanded')) {
          toggleAuditConsole();
        }
      } else {
        auditStatusBadge.textContent = 'SISTEMA SEGURO';
        auditStatusBadge.className = 'badge emerald-badge audit-status';
      }

      // Reflected XSS: Renderizar el feedback directamente en el DOM mediante innerHTML
      const feedback = document.getElementById('search-feedback-text');
      if (query) {
        // VULNERABILIDAD: Se asigna innerHTML directamente sin escapar
        feedback.innerHTML = `Resultados de la búsqueda: <strong>${query}</strong> (${data.results.length} chips encontrados)`;
      } else {
        feedback.innerHTML = '';
      }

      // Renderizar componentes en el Grid
      const grid = document.getElementById('product-grid');
      grid.innerHTML = '';
      
      data.results.forEach(product => {
        const card = document.createElement('div');
        card.className = 'component-card';
        const cleanPrice = product.price.replace('$', '');
        
        // Asignar imagen del componente según el nombre o categoría
        let imgName = 'stm32.png';
        if (product.name.includes('ESP32')) {
          imgName = 'esp32.png';
        } else if (product.name.includes('SX1276')) {
          imgName = 'lora.png';
        } else if (product.category.includes('Inalámbrico')) {
          imgName = 'esp32.png';
        }
        
        card.innerHTML = `
          <div class="component-card-image-wrapper">
            <img src="/images/${imgName}" alt="${product.name}" class="component-card-img">
          </div>
          <div class="component-card-content">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
              <h3>${product.name}</h3>
              <span class="comp-tag">${product.category}</span>
            </div>
            <p>${product.description}</p>
          </div>
          <div class="component-footer">
            <span class="comp-price">${product.price}</span>
            <button class="btn-orange" style="padding: 0.45rem 1rem; font-size: 0.8rem; border-radius: 4px;" onclick="openCheckout(${product.id}, '${product.name}', ${cleanPrice})">Comprar Lote</button>
          </div>
        `;
        grid.appendChild(card);
      });
    })
    .catch(err => console.error('Error cargando componentes:', err));
}

// =======================================================
// A04: INSECURE DESIGN - CHECKOUT PROCESS
// =======================================================
function openCheckout(id, name, price) {
  document.getElementById('checkout-panel').style.display = 'block';
  document.getElementById('checkout-item-name').textContent = name;
  document.getElementById('checkout-item-id').value = id;
  document.getElementById('checkout-price').value = price;
  document.getElementById('checkout-qty').value = 10;
  calculateTotal();
}

function closeCheckout() {
  document.getElementById('checkout-panel').style.display = 'none';
}

function calculateTotal() {
  const qty = parseInt(document.getElementById('checkout-qty').value) || 0;
  const price = parseFloat(document.getElementById('checkout-price').value) || 0;
  const total = qty * price;
  document.getElementById('checkout-total').textContent = `$${total.toFixed(2)}`;
}

function processCheckout() {
  const itemId = document.getElementById('checkout-item-id').value;
  const name = document.getElementById('checkout-item-name').textContent;
  const quantity = document.getElementById('checkout-qty').value;
  const price = document.getElementById('checkout-price').value;

  fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ itemId, quantity, price })
  })
  .then(res => res.json())
  .then(data => {
    // Alerta de Auditoría
    const lfiTelemetry = document.getElementById('lfi-path-telemetry');
    lfiTelemetry.textContent = `A04: Insecure Design Checkout\nEnviado JSON: {"itemId": ${itemId}, "quantity": ${quantity}, "price": ${price}}\n\nRespuesta del servidor:\n${JSON.stringify(data, null, 2)}`;
    
    // Si hay discrepancia de precio o cantidad negativa, alertar en la barra SOC
    const actualPriceText = document.getElementById('checkout-price').value;
    const qtyInt = parseInt(quantity);
    if (qtyInt <= 0) {
      const auditStatusBadge = document.getElementById('badge-sqli-shop');
      auditStatusBadge.textContent = 'A04: MANIPULACIÓN CANTIDAD NEGATIVA';
      auditStatusBadge.className = 'badge red-badge audit-status';
      
      const panel = document.getElementById('audit-panel');
      if (!panel.classList.contains('expanded')) {
        toggleAuditConsole();
      }
    }

    alert(`Pedido Procesado!\nComponente: ${data.item}\nCantidad: ${data.qty}\nPrecio Total Facturado: ${data.total}`);
    closeCheckout();
  })
  .catch(err => {
    console.error('Error procesando checkout:', err);
    alert('Fallo al conectar con el procesador de pedidos de Nexus.');
  });
}

// =======================================================
// A07: LOGIN & A09: LOG INJECTION
// =======================================================
function handleLogin(event) {
  event.preventDefault();
  const usernameInput = document.getElementById('login-username').value;
  const passwordInput = document.getElementById('login-password').value;

  fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usernameInput, password: passwordInput })
  })
  .then(res => res.json())
  .then(data => {
    // Registrar consulta SQL en el panel de auditoría
    const queryTelemetryCode = document.getElementById('query-code-shop');
    queryTelemetryCode.textContent = data.query;

    const auditStatusBadge = document.getElementById('badge-sqli-shop');
    
    // Detectar inyección de logs (A09) si el username contiene saltos de línea \n
    if (usernameInput.includes('\n') || usernameInput.includes('\r')) {
      auditStatusBadge.textContent = 'A09: LOG INJECTION DETECTADO';
      auditStatusBadge.className = 'badge red-badge audit-status';
      
      const panel = document.getElementById('audit-panel');
      if (!panel.classList.contains('expanded')) {
        toggleAuditConsole();
      }
      
      const lfiTelemetry = document.getElementById('lfi-path-telemetry');
      lfiTelemetry.textContent = `A09: Log Injection / Log Forging\nSe detectó salto de línea inyectado en el archivo security_alerts.log.\nEntrada:\n${usernameInput}`;
    }

    if (data.injected) {
      auditStatusBadge.textContent = 'A03: SQLi LOGIN BYPASS';
      auditStatusBadge.className = 'badge red-badge audit-status';
      
      const panel = document.getElementById('audit-panel');
      if (!panel.classList.contains('expanded')) {
        toggleAuditConsole();
      }
    }

    if (data.success) {
      currentUser = data.user;
      
      const wsUsername = document.getElementById('ws-username');
      const wsDot = wsUsername.previousElementSibling;
      
      wsUsername.textContent = `Entorno: ${currentUser.username} (${currentUser.role})`;
      wsDot.className = 'status-dot blue';
      
      const loginTrigger = document.getElementById('btn-login-trigger');
      loginTrigger.innerHTML = `<i class="fa-solid fa-right-from-bracket"></i> Desconectarse`;
      loginTrigger.onclick = handleLogout;
      
      switchTab('home');
      alert(`Acceso de ingeniería verificado con éxito.\nSesión: ${currentUser.username}\nRol: ${currentUser.role}`);
    } else {
      alert(`Error en autenticación: ${data.message}`);
    }
  })
  .catch(err => {
    console.error('Error en autenticación:', err);
    alert('Fallo en la comunicación con el servidor de licencias Nexus.');
  });
}

function handleLogout() {
  currentUser = { username: 'guest', role: 'guest_reviewer' };
  
  const wsUsername = document.getElementById('ws-username');
  const wsDot = wsUsername.previousElementSibling;
  wsUsername.textContent = 'Entorno: Invitado';
  wsDot.className = 'status-dot green';

  const loginTrigger = document.getElementById('btn-login-trigger');
  loginTrigger.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión`;
  loginTrigger.onclick = () => switchTab('login');

  switchTab('home');
  alert('Sesión de Workspace cerrada correctamente.');
}

// =======================================================
// A08: SOFTWARE & DATA INTEGRITY - INSECURE DESERIALIZATION
// =======================================================
function importProfile() {
  const base64Data = document.getElementById('import-base64-data').value.trim();
  const outputBox = document.getElementById('import-output-box');
  const resultText = document.getElementById('import-result-text');
  
  if (!base64Data) {
    alert('Por favor, pegue un bloque de configuración en Base64.');
    return;
  }

  fetch('/api/import-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64Data })
  })
  .then(res => res.json())
  .then(data => {
    outputBox.style.display = 'block';
    
    // Telemetría en el visualizador
    if (data.error) {
      resultText.textContent = `[Integridad fallida]\n${data.error}`;
    } else {
      resultText.textContent = JSON.stringify(data, null, 2);
    }
    
    // Telemetría de integridad en la consola SOC
    const lfiTelemetry = document.getElementById('lfi-path-telemetry');
    lfiTelemetry.textContent = `A08: Insecure Deserialization\nPayload decodificado:\n${atob(base64Data)}\n\nResultado:\n${JSON.stringify(data, null, 2)}`;
    
    const auditStatusBadge = document.getElementById('badge-sqli-shop');
    if (atob(base64Data).includes('_$$ND_FUNC$$_')) {
      auditStatusBadge.textContent = 'A08: DESERIALIZACIÓN INSEGURA';
      auditStatusBadge.className = 'badge red-badge audit-status';
      
      const panel = document.getElementById('audit-panel');
      if (!panel.classList.contains('expanded')) {
        toggleAuditConsole();
      }
    }
  })
  .catch(err => {
    console.error('Error importando perfil:', err);
    alert('Error crítico de integridad de datos.');
  });
}

// =======================================================
// A03: STORED XSS - DESIGN REVIEW COMMENTS
// =======================================================
function loadComments() {
  fetch('/api/comments')
    .then(res => res.json())
    .then(data => {
      const list = document.getElementById('comments-list');
      list.innerHTML = '';
      
      data.forEach(c => {
        const card = document.createElement('div');
        card.className = 'comment-card';
        card.innerHTML = `
          <div class="comment-header">
            <span class="comment-author"><i class="fa-regular fa-user"></i> ${c.author}</span>
            <span class="comment-date">${c.date}</span>
          </div>
          <div class="comment-body">${c.content}</div>
        `;
        list.appendChild(card);
      });
    })
    .catch(err => console.error('Error cargando notas de diseño:', err));
}

function handlePostComment(event) {
  event.preventDefault();
  const author = document.getElementById('comment-author').value;
  const content = document.getElementById('comment-content').value;

  fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ author, content })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      document.getElementById('comment-author').value = '';
      document.getElementById('comment-content').value = '';
      loadComments();
    }
  })
  .catch(err => console.error('Error guardando nota de diseño:', err));
}

// =======================================================
// A03: COMMAND INJECTION & A10: SSRF
// =======================================================
function runPing() {
  const target = document.getElementById('ping-target').value;
  const output = document.getElementById('ping-output');
  const commandLine = document.getElementById('executed-command');
  const commandText = document.getElementById('command-text');
  
  output.textContent = 'Enviando ráfaga ICMP de diagnóstico de red a Nexus IoT Edge node...';
  commandLine.style.display = 'none';

  fetch('/api/diagnostics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target })
  })
  .then(res => res.json())
  .then(data => {
    commandLine.style.display = 'block';
    commandText.textContent = data.command;
    
    if (data.error) {
      output.textContent = `[SYSTEM CORE FAULT]\n\n${data.error}\n\nStderr Logs:\n${data.stderr}`;
    } else {
      output.textContent = data.stdout || data.stderr || 'Comando completado sin salida.';
    }

    const processTelemetry = document.getElementById('command-code-telemetry');
    processTelemetry.textContent = `A03: Command Injection\nTarget: ${target}\nCommand Executed: ${data.command}\n\nStdout:\n${data.stdout}`;
    
    const isCmdInjection = /[;|&&|\||`|\$]/.test(target);
    const auditStatusBadge = document.getElementById('badge-sqli-shop');
    if (isCmdInjection) {
      auditStatusBadge.textContent = 'INYECCIÓN DE COMANDOS';
      auditStatusBadge.className = 'badge red-badge audit-status';
      
      const panel = document.getElementById('audit-panel');
      if (!panel.classList.contains('expanded')) {
        toggleAuditConsole();
      }
    }
  })
  .catch(err => {
    console.error('Error en diagnóstico Edge:', err);
    output.textContent = 'Fallo en la comunicación con el Gateway del laboratorio local.';
  });
}

function fetchExternalSpec() {
  const urlTarget = document.getElementById('ssrf-url-target').value;
  const output = document.getElementById('ping-output');
  const commandLine = document.getElementById('executed-command');
  const commandText = document.getElementById('command-text');
  
  output.textContent = `Realizando petición Gateway remota a: ${urlTarget}...`;
  commandLine.style.display = 'none';

  fetch(`/api/fetch-spec?url=${encodeURIComponent(urlTarget)}`)
    .then(res => res.text())
    .then(bodyText => {
      // Mostrar en visor de terminal
      output.textContent = bodyText || 'Respuesta vacía del recurso remoto.';
      
      // Registrar telemetría SSRF (A10)
      const processTelemetry = document.getElementById('command-code-telemetry');
      processTelemetry.textContent = `A10: Server-Side Request Forgery\nURL Solicitada por el Servidor: ${urlTarget}\n\nRespuesta:\n${bodyText.substring(0, 1000)}`;
      
      // Alertar en consola SOC si se apunta a localhost/127.0.0.1
      const isInternal = urlTarget.includes('localhost') || urlTarget.includes('127.0.0.1');
      const auditStatusBadge = document.getElementById('badge-sqli-shop');
      if (isInternal) {
        auditStatusBadge.textContent = 'A10: SSRF INTERNO DETECTADO';
        auditStatusBadge.className = 'badge red-badge audit-status';
        
        const panel = document.getElementById('audit-panel');
        if (!panel.classList.contains('expanded')) {
          toggleAuditConsole();
        }
      }
    })
    .catch(err => {
      console.error('Error en SSRF Spec Fetch:', err);
      output.textContent = `Fallo al resolver gateway externa: ${err.message}`;
    });
}

// =======================================================
// A01: BROKEN ACCESS CONTROL (IDOR) & LFI
// =======================================================
function loadProjectFromInput() {
  const id = document.getElementById('idor-project-id-input').value;
  loadProject(id);
}

function loadProject(id) {
  const detailsBox = document.getElementById('project-details-box');
  const nameDisplay = document.getElementById('project-name-display');
  const descDisplay = document.getElementById('project-desc-display');
  const badgeConfidential = document.getElementById('project-confidential-badge');
  const filesList = document.getElementById('project-files-list');

  // Enviar cabecera de usuario actual para telemetría
  const userHeader = currentUser.username;

  fetch(`/api/projects/${id}?user=${encodeURIComponent(userHeader)}`)
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(`Error al cargar proyecto: ${data.error}`);
        return;
      }
      
      detailsBox.style.display = 'block';
      nameDisplay.textContent = data.name;
      descDisplay.textContent = data.description;
      
      // Archivos asociados
      filesList.innerHTML = '';
      data.files.forEach(file => {
        const li = document.createElement('li');
        li.textContent = file;
        filesList.appendChild(li);
      });

      // Configurar badge confidencial
      if (data.confidential) {
        badgeConfidential.style.display = 'inline-block';
        badgeConfidential.textContent = 'CONFIDENCIAL (A01 IDOR)';
        badgeConfidential.className = 'badge red-badge';
        
        // Alerta de Auditoría SOC
        const auditStatusBadge = document.getElementById('badge-sqli-shop');
        auditStatusBadge.textContent = 'A01: ACCESO IDOR DETECTADO';
        auditStatusBadge.className = 'badge red-badge audit-status';
        
        const panel = document.getElementById('audit-panel');
        if (!panel.classList.contains('expanded')) {
          toggleAuditConsole();
        }
        
        const lfiTelemetry = document.getElementById('lfi-path-telemetry');
        lfiTelemetry.textContent = `A01: IDOR (Insecure Direct Object Reference)\nAcceso sin autorización al recurso ID: ${id}\nProyecto: ${data.name}\nDueño: ${data.owner}\nConsultado por: ${userHeader}`;
      } else {
        badgeConfidential.style.display = 'inline-block';
        badgeConfidential.textContent = 'PÚBLICO';
        badgeConfidential.className = 'badge emerald-badge';
      }
    })
    .catch(err => {
      console.error('Error en IDOR Project Load:', err);
      alert('Error de red al consultar ficheros de esquemáticos.');
    });
}

function loadManual(filename) {
  const docsContent = document.getElementById('docs-content');
  const filenameText = document.getElementById('viewer-filename-text');
  
  docsContent.textContent = 'Solicitando hoja técnica de especificaciones al servidor...';
  filenameText.textContent = filename;
  
  const url = `/api/download?file=${filename}`;

  fetch(url)
    .then(res => {
      filenameText.textContent = filename;
      return res.text();
    })
    .then(text => {
      docsContent.textContent = text;
      
      const lfiTelemetry = document.getElementById('lfi-path-telemetry');
      lfiTelemetry.textContent = `A01: LFI (Local File Inclusion)\nPetición HTTP: ${url}\nResolución de Fichero:\n${filename}`;
      
      const auditStatusBadge = document.getElementById('badge-sqli-shop');
      if (filename.includes('..')) {
        auditStatusBadge.textContent = 'LFI / PATH TRAVERSAL DETECTADO';
        auditStatusBadge.className = 'badge red-badge audit-status';
        
        const panel = document.getElementById('audit-panel');
        if (!panel.classList.contains('expanded')) {
          toggleAuditConsole();
        }
      }
    })
    .catch(err => {
      console.error('Error en LFI:', err);
      docsContent.textContent = 'Fallo al resolver la especificación técnica en el servidor local.';
    });
}
