# Nexus Develop - Entorno de Pruebas de Ingeniería (OWASP Top 10 Lab)

Este es un portal corporativo y de ingeniería de hardware deliberadamente vulnerable desarrollado en **Node.js y Express**. Ha sido estructurado específicamente con fines educativos y de demostración para cubrir **las 10 categorías del estándar OWASP Top 10 (2021)**.

Su diseño visual replica el estilo del portal de **Altium Develop** (esquemas limpios, color naranja corporativo, y diseño de tarjetas de componentes electrónicos), simulando una aplicación empresarial de producción donde las vulnerabilidades están ocultas.

## ⚠️ AVISO DE SEGURIDAD
Este software contiene múltiples vulnerabilidades críticas de manera intencional.
- **Ejecución Local Exclusiva:** El servidor está enlazado únicamente a `127.0.0.1`. **NO lo expongas a Internet**.
- **Panel SOC Integrado:** La consola colapsable en el pie de página (`SOC SECURITY MONITORING PANEL`) muestra las consultas SQL, comandos y trazas generadas en tiempo real durante la simulación de incidentes, ideal para alimentar a tu SIEM.

---

## 🛠️ Cómo Iniciar la Aplicación

### Paso 1: Instalar dependencias
Accede a la carpeta `/home/jeantc/Proyectos/pagina-webvul` y ejecuta:
```bash
npm install
```
*(Nota: Esto instalará las dependencias, incluyendo versiones obsoletas y vulnerables de `express` y `minimist` correspondientes a la categoría A06).*

### Paso 2: Iniciar el servidor
Arranca el servidor local:
```bash
npm start
```
El portal estará disponible en: [http://127.0.0.1:3000](http://127.0.0.1:3000).

---

## 🔍 Guía de Simulación del OWASP Top 10 (2021)

### A01:2021-Broken Access Control
*   **Vector 1: Path Traversal / LFI**
    *   *Ubicación:* Pestaña **Ficheros Gerber & IDOR** -> Catálogo de Manuales.
    *   *Prueba:* Abre un manual y observa la petición en el panel SOC. Cambia la petición manual del navegador para leer ficheros del sistema: `/api/download?file=../../package.json` o `/api/download?file=../../../../etc/passwd`.
*   **Vector 2: IDOR (Insecure Direct Object Reference)**
    *   *Ubicación:* Pestaña **Ficheros Gerber & IDOR** -> Proyectos CAD Activos.
    *   *Prueba:* Haz clic en "Cargar" o modifica el ID manual. Al cambiar a `1`, accederás al proyecto confidencial "Satélite Experimental" del usuario `admin` sin que el portal verifique tu rol o sesión.

### A02:2021-Cryptographic Failures
*   *Ubicación:* Pestaña **Backups Corporativos** (enlace en el menú superior) -> Archivo `config_backup.json`.
*   *Prueba:* Abre la copia de seguridad y comprueba cómo se exponen claves privadas, secretos de MS Graph API y contraseñas de bases de datos de producción en texto claro.

### A03:2021-Injection
*   **SQL Injection (Bypass):** En la pestaña **Iniciar Sesión**, ingresa `' OR '1'='1` en el usuario para iniciar sesión como `admin` de forma ilícita.
*   **SQL Injection (UNION/Exfiltración):** En **Componentes & Compras**, busca `' UNION SELECT` para exfiltrar las credenciales del personal de ingeniería.
*   **Stored XSS:** En **Revisiones de Diseño**, publica una nota con el mensaje: `<img src=x onerror="alert('XSS')">`.
*   **Command Injection:** En **Edge Diagnostics**, ingresa en la dirección IP: `127.0.0.1; whoami` para ejecutar comandos arbitrarios en el sistema operativo del servidor.

### A04:2021-Insecure Design
*   *Ubicación:* Pestaña **Componentes & Compras** -> Formulario de Checkout.
*   *Prueba:* Haz clic en "Comprar Lote" en cualquier componente. El formulario de pedido permite modificar el precio unitario antes de procesar, o ingresar una cantidad de lote negativa (ej: `-10`) para restar saldo y alterar la lógica del importe final del pedido.

### A05:2021-Security Misconfiguration
*   *Ubicación:* Enlace superior **Backups Corporativos** (`/backups`).
*   *Prueba:* El portal tiene la configuración de listado de directorios activa (Directory Listing), permitiendo a cualquier atacante ver y descargar las copias de seguridad del servidor.

### A06:2021-Vulnerable and Outdated Components
*   *Ubicación:* [package.json](file:///home/jeantc/Proyectos/pagina-webvul/package.json).
*   *Prueba:* El portal utiliza dependencias obsoletas con CVEs críticas conocidas (ej: `minimist` en versión `1.2.0`, vulnerable a Prototype Pollution).

### A07:2021-Identification and Authentication Failures
*   *Ubicación:* Formulario de Login.
*   *Prueba:* El portal carece de bloqueos por reintentos o rate limiting en el endpoint `/api/login`, lo que facilita ataques automatizados de Brute Force o Credential Stuffing, sumado al uso de contraseñas por defecto débiles (`guest` / `password`).

### A08:2021-Software and Data Integrity Failures
*   *Ubicación:* Pestaña **Iniciar Sesión** -> Importar Perfil de Integración.
*   *Prueba:* El sistema recibe y procesa datos serializados en Base64 de forma insegura (evaluando comandos inyectados en el parser). Pega este bloque Base64 para simular un ataque de Remote Code Execution (RCE) por deserialización:
    `eyJ1c2VybmFtZSI6ICJ0ZXN0IiwgIl9fJCRORF9GVU5DJCRfXyI6ICJmdW5jdGlvbigpe3JldHVybiAnUkNFIHNpbXVsYWRvIGNvbXBsZXRvJzt9In0=`

### A09:2021-Security Logging and Monitoring Failures
*   *Ubicación:* Fichero de logs `security_alerts.log`.
*   *Prueba:* El backend guarda entradas en el log de auditoría sin limpiar los caracteres especiales de salto de línea (`\n`). Un atacante puede inyectar saltos de línea en el campo de Login para forjar alertas falsas:
    `invitado\n[2026-07-09] [ALERT] [TYPE: SQL_INJECTION_LOGIN] - {"username":"admin","query":"SELECT..."}`

### A10:2021-Server-Side Request Forgery (SSRF)
*   *Ubicación:* Pestaña **Edge Diagnostics** -> Importar Ficha Técnica (SSRF Gateway).
*   *Prueba:* Ingresa en el input de la URL la dirección de la API local del servidor: `http://localhost:3000/api/comments`. El servidor realizará la consulta de forma interna y expondrá la información protegida de comentarios.

---
Este fichero sirve como fuente de ingesta directa para alimentar las reglas KQL y los dashboards interactivos de tu SIEM.
