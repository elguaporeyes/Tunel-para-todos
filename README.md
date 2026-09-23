# 🚇 MiTunel - Servicio de Tunelización Localhost a Red Pública

Plataforma completa de proxy inverso y tunelización segura (alternativa moderna a ngrok y LocalTunnel) construida en Node.js con modelo **Freemium**, sistema de créditos semanales recargables, notificaciones por correo y suscripciones Premium vía Stripe.

---

## 🚀 Instalación e Inicio Rápido

**MiTunel** te permite exponer tu servidor local a internet en segundos, con asignación automática de tokens y 100 créditos semanales gratuitos.

---

### 📦 1. Instalación

#### Opción A: Descargar el ejecutable binario (Recomendado para Windows)
Descarga el ejecutable standalone `mitunel.exe` desde las **Releases** del repositorio (o compílalo localmente en `apps/cli/dist/mitunel.exe`) y colócalo en una carpeta incluida en tu `PATH` (por ejemplo, `C:\Windows\System32` o una carpeta personalizada de binarios).

Para verificar la instalación:
```bash
mitunel --help
```

#### Opción B: Uso directo con Node.js (Multiplataforma: Windows, Linux, macOS)
Si tienes Node.js 18+ instalado, puedes clonar el repositorio y usar el CLI directamente:
```bash
# Desde la raíz del proyecto
npm run cli -- --help

# O usando el archivo ejecutable de Node:
node apps/cli/bin/mitunel.js --help
```

---

### ⚡ 2. Inicio Rápido en 3 Pasos

#### Paso 1 — Crear tu cuenta y obtener tu Token automáticamente
No necesitas abrir el navegador ni configurar contraseñas complejas. Ejecuta en tu terminal:

```bash
mitunel register tu-correo@ejemplo.com
```

**¿Qué ocurre internamente?**
1. El CLI se comunica de forma segura con el Control Plane (`/api/auth/register`).
2. Se genera tu API Token único de autenticación (`tk_live_...`).
3. Se asignan **100 créditos semanales gratuitos** a tu cuenta.
4. El token se almacena de forma segura y automática en tu configuración local:
   - **Windows:** `%USERPROFILE%\.mitunel\config.json`
   - **Linux / macOS:** `~/.mitunel/config.json`
5. Recibes un **correo electrónico de bienvenida con diseño HTML limpio** y soporte Multi-part MIME que incluye tu token, tus créditos y los comandos de inicio rápido.
6. *Resiliencia para usuarios existentes:* Si tu correo ya estaba registrado en el sistema, la API responde amigablemente y reenvía tu token activo a tu bandeja de entrada.

> *(Opcional)* Si ya disponías de un token generado anteriormente, puedes guardarlo manualmente ejecutando:
> ```bash
> mitunel authtoken tk_live_xxxxxxxxxxxxxxxxxxxxxxxx
> ```

---

#### Paso 2 — Iniciar tu servidor o servicio local
Asegúrate de que tu aplicación o servidor web esté corriendo localmente. Si no tienes uno a mano, puedes usar el servidor de demostración incluido:

```bash
# Servidor de prueba en el puerto 3000
node apps/hello-world.js
```

---

#### Paso 3 — Abrir el túnel seguro hacia internet

```bash
mitunel http 3000
```

¡Listo! La terminal mostrará tu URL pública segura con HTTPS y el panel de tráfico en tiempo real:

```text
========================================================================
  🚇  MiTunel CLI  -  Localhost Reverse Proxy Gateway  [ FREE TIER ]
========================================================================
  Estado:           ● En Línea
  Túnel Público:    https://a1b2c3d4.mitunel-proxy.onrender.com
  Servicio Local:   http://localhost:3000
  Subdominio:       a1b2c3d4
  Créditos:         100 restantes esta semana
------------------------------------------------------------------------
  HISTORIAL DE PETICIONES HTTP EN TIEMPO REAL:
  HORA       MÉTODO   ESTADO   DURACIÓN   RUTA
  12:05:01   GET      200      12ms       /
  12:05:04   POST     201      28ms       /api/login
========================================================================
```

> **💡 Tip de Conectividad:** El cliente CLI cuenta con un mecanismo de **keep-alive inteligente** (ping automático cada 30 segundos) que previene desconexiones por inactividad impuestas por proxies en la nube como Render, Cloudflare o Nginx.

---

## 🛠️ Comandos Disponibles en la CLI

| Comando | Descripción |
|---|---|
| `mitunel register <email>` | Crea una cuenta nueva, asigna 100 créditos y guarda el token automáticamente |
| `mitunel authtoken <TOKEN>` | Configura manualmente tu token (`tk_live_...`) en `~/.mitunel/config.json` |
| `mitunel http <PUERTO>` | Inicia el túnel HTTP/WebSocket hacia el puerto local indicado |
| `mitunel http <PUERTO> --subdomain <nombre>` | Solicita un subdominio personalizado fijo (Requiere plan Premium) |
| `mitunel http <PUERTO> --server <URL>` | Conecta a un servidor de tunelización personalizado |
| `mitunel --help` | Muestra la ayuda general y opciones |
| `mitunel --version` | Muestra la versión actual de la herramienta |

---

## 🏗️ Estructura del Monorepo

```
tuneling-para-todos/
├── apps/
│   ├── control-plane/     # Backend REST API (Auth, Email Service, Créditos, Stripe, MongoDB)
│   │   ├── src/controllers/  # Controladores (authController con register y login)
│   │   ├── src/services/     # Servicios (emailService con Nodemailer y cronService)
│   │   └── src/models/       # Modelos Mongoose (User, ApiKey)
│   ├── tunnel-proxy/      # Edge Server HTTP + WebSocket Gateway (Enrutamiento por subdominio)
│   ├── cli/               # Cliente de consola en Node.js empaquetable en binario .exe con 'pkg'
│   │   ├── bin/mitunel.js    # Punto de entrada de comandos CLI
│   │   ├── src/config.js     # Manejo seguro y tolerante a fallos de ~/.mitunel/config.json
│   │   └── dist/mitunel.exe  # Binario standalone ejecutable en Windows x64
│   └── hello-world.js     # Servidor local de prueba en el puerto 3000
├── packages/
│   └── common/            # Constantes compartidas, códigos de error y protocolo multiplexado
├── deployment/            # Configuración Nginx para certificados Wildcard (*.tudominio.com)
├── docs/                  # Documentación y guía de despliegue en VPS
└── docker-compose.yml     # Orquestación de contenedores en desarrollo y producción
```

---

## 📧 Configuración del Servicio de Correos (Control Plane)

El backend de `apps/control-plane` utiliza **Nodemailer** para la entrega de correos electrónicos transaccionales (bienvenida, entrega de tokens y recuperación de credenciales).

En `apps/control-plane/.env`:
```env
# Configuración SMTP (Gmail, Brevo, SendGrid, Resend SMTP, Mailtrap, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-correo@gmail.com
SMTP_PASS=tu-contraseña-de-aplicacion
EMAIL_FROM="MiTunel" <no-reply@mitunel.dev>
```

> **🛡️ Tolerancia a Fallos en Desarrollo:** Si las variables SMTP no están definidas, el sistema opera en modo seguro de desarrollo, simulando el envío e imprimiendo el token en la consola del servidor sin bloquear ni interrumpir el registro del usuario.

---

## ⚡ Desarrollo Local y Contribución

### Requisitos Previos
- Node.js 18 o superior
- npm 9 o superior
- Docker y Docker Compose (opcional para MongoDB local)

### Puesta en Marcha

```bash
# 1. Instalar todas las dependencias del monorepo
npm install

# 2. Levantar la base de datos local con Docker (o usar MongoDB Atlas)
docker compose up -d mongodb

# 3. Iniciar el Control Plane (API en http://localhost:4000)
npm run dev:control-plane

# 4. Iniciar el Edge Tunnel Proxy (Gateway en http://localhost:8080)
npm run dev:proxy

# 5. Ejecutar la suite de pruebas unitarias y de integración
node --test test/system.test.js
```

### Compilar el Ejecutable para Windows

Para compilar el binario standalone `mitunel.exe` en `apps/cli/dist/`:
```bash
npm run build:cli-exe
```

---

## 💳 Modelo Freemium y Facturación

1. **Free Tier:**
   - **100 créditos semanales** asignados automáticamente al registrarse.
   - Restablecimiento automático mediante un Cron Job cada **7 días a las 00:00 UTC**.
   - Al agotarse los créditos, el proxy responde con `HTTP 402 Payment Required` y la CLI notifica al usuario con un enlace para recargar o actualizar su cuenta.

2. **Premium Tier ($/mes vía Stripe):**
   - Conexiones y créditos ilimitados.
   - Reserva de subdominios fijos garantizados (`mi-proyecto.mitunel.dev`).
   - Portal de gestión de suscripciones integrado con Stripe Customer Portal.

---

## 🌐 Despliegue en la Nube

Para consultar la configuración de producción en servidores VPS con Nginx y certificados SSL Wildcard de Let's Encrypt, consulta la [Guía Completa de Despliegue en VPS](./docs/VPS_DEPLOYMENT_GUIDE.md).

URLs de producción por defecto:
- **Control Plane API:** `https://tunel-para-todos.onrender.com`
- **Tunnel Proxy Gateway:** `https://mitunel-proxy.onrender.com`

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE). Puedes usarlo, adaptarlo y mejorarlo libremente.
