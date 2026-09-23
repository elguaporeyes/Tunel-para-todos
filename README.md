# 🚇 MiTunel - Servicio de Tunelización Localhost a Red Pública

Plataforma completa de proxy inverso y tunelización segura (alternativa a ngrok / LocalTunnel) construida en Node.js con modelo de negocio **Freemium**, sistema de créditos semanales recargables y suscripciones Premium vía Stripe.

---

## 🚀 Inicio Rápido con el Ejecutable Windows (`mitunel.exe`)

> **No necesitas Node.js instalado.** Descarga el binario y úsalo directamente desde la terminal.

### Paso 1 — Crear tu cuenta y obtener tu API Key

El ejecutable incluye registro directo desde la consola sin necesidad de herramientas externas:

```powershell
.\mitunel.exe register tu@email.com
```

El comando creará tu cuenta en la nube, generará tu clave (`tk_live_...`) y la guardará automáticamente en tu sistema con **100 créditos semanales gratuitos**.

> Si ya dispones de una cuenta previa creada en [https://tunel-para-todos.onrender.com](https://tunel-para-todos.onrender.com), puedes vincular tu token manualmente siguiendo el Paso 2. *(Si utilizaste `mitunel register`, este paso ya se realizó de forma automática).*

### Paso 2 — Guardar tu API Key en el sistema (Opcional si usaste register)

```powershell
.\mitunel.exe authtoken tk_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

El token queda guardado de forma segura en `%USERPROFILE%\.mitunel\config.json`. **Sobrevive actualizaciones del .exe.**

### Paso 3 — Iniciar tu servidor local de prueba

Si no tienes una aplicación corriendo, puedes usar el servidor de ejemplo incluido en el proyecto:

```powershell
# Con Node.js instalado:
node apps/hello-world.js

# O cualquier servidor tuyo en cualquier puerto, por ejemplo React:
npm start
```

### Paso 4 — Abrir el túnel público

```powershell
.\mitunel.exe http 3000
```

La consola mostrará la URL pública asignada y el panel de tráfico en tiempo real:

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

### Paso 5 — Compartir la URL pública

Comparte la URL del paso anterior con quien necesites. Dado que Render proporciona certificados SSL automáticos, la URL funciona de forma segura sobre **`https://`** (así como sobre `http://`). Todas las peticiones entrarán por `mitunel-proxy.onrender.com`, pasarán por el túnel WebSocket y llegarán a tu `localhost:3000`.

> **💡 Tip:** Para mantener el túnel activo de forma permanente, el cliente incluye un **keep-alive automático de ping cada 30 segundos** que evita desconexiones por inactividad en plataformas cloud (Render, Heroku, Railway, etc.).

### 💡 Instalación Global (Opcional)

Para ejecutar `mitunel` desde cualquier carpeta sin anteponer `.\`:
1. Mueve `mitunel.exe` a `C:\Windows\System32\Mitunel\` (o cualquier carpeta en tu PATH).
2. ¡Listo! Ya puedes usar simplemente `mitunel http 3000` en cualquier terminal.

---

## 📦 Opciones Avanzadas del CLI

| Comando | Descripción |
|---|---|
| `mitunel.exe register <EMAIL>` | Crea una cuenta nueva y guarda el token automáticamente |
| `mitunel.exe authtoken <KEY>` | Guarda tu API Key en `~/.mitunel/config.json` |
| `mitunel.exe http <PUERTO>` | Abre un túnel HTTP hacia el puerto local especificado |
| `mitunel.exe http <PUERTO> --subdomain mi-app` | Subdominio personalizado (Plan Premium) |
| `mitunel.exe http <PUERTO> --server <URL>` | Usar un servidor proxy personalizado |
| `mitunel.exe --help` | Mostrar ayuda completa |
| `mitunel.exe --version` | Mostrar versión del cliente |

---

## 🏗️ Arquitectura del Sistema

El monorepo está organizado en workspaces independientes:

```
tuneling-para-todos/
├── apps/
│   ├── control-plane/     # Backend REST API (Auth JWT, Créditos, Webhook Stripe, MongoDB)
│   ├── tunnel-proxy/      # Edge Server HTTP + WebSocket Gateway (Enrutamiento por subdominio)
│   ├── cli/               # Binario ejecutable 'mitunel' para consola con TUI en tiempo real
│   └── hello-world.js     # Servidor de prueba "Hello World" en puerto 3000
├── packages/
│   └── common/            # Protocolo de multiplexación y constantes compartidas
├── deployment/            # Configuración Nginx para SSL Wildcard (*.tudominio.com)
├── docs/                  # Guía de despliegue en servidor VPS
└── docker-compose.yml     # Orquestación de desarrollo y producción
```

---

## ⚡ Desarrollo Local (para Contribuidores)

### Requisitos
- Node.js 18+ 
- Docker y Docker Compose (para MongoDB local)

### Levantar el entorno completo

```bash
# 1. MongoDB local
docker compose up -d mongodb

# 2. Copiar variables de entorno
cp apps/control-plane/.env.example apps/control-plane/.env
cp apps/tunnel-proxy/.env.example apps/tunnel-proxy/.env

# 3. Instalar dependencias
npm install

# Terminal 1: Control Plane & Billing API (Puerto 4000)
npm run dev:control-plane

# Terminal 2: Edge Tunnel Proxy (Puerto 8080)
npm run dev:proxy

# Terminal 3: Servidor de prueba Hello World (Puerto 3000)
npm run start:hello
```

### Compilar el ejecutable Windows

```bash
npm run build:cli-exe
# Genera: apps/cli/dist/mitunel.exe
```

---

## 💳 Modelo Freemium y Facturación

1. **Free Tier:**
   - 100 créditos semanales asignados automáticamente.
   - Restablecimiento automático mediante Cron Job cada **7 días a las 00:00 UTC**.
   - Al agotarse los créditos, el proxy responde con `HTTP 402 Payment Required` y la CLI muestra un aviso con enlace de actualización.

2. **Premium Tier ($/mes vía Stripe):**
   - Créditos y horas de conexión ilimitadas.
   - Reserva de subdominios fijos garantizados (`mi-empresa.tudominio.com`).
   - Gestión de suscripción vía Stripe Customer Portal.

---

## 🌐 Despliegue en Producción (VPS o Render)

Consulta la [Guía Completa de Despliegue en VPS](./docs/VPS_DEPLOYMENT_GUIDE.md) para configurar:
- Registros DNS Wildcard (`*.tudominio.com`).
- Certificados SSL Wildcard gratuitos con Let's Encrypt / Certbot.
- Terminador SSL y proxy inverso de alto rendimiento con Nginx.

Para despliegue en **Render.com** los servicios en la nube son:
- Control Plane: `https://tunel-para-todos.onrender.com`
- Tunnel Proxy: `https://mitunel-proxy.onrender.com`

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE). Puedes usarlo y modificarlo libremente.

