# 🚇 MiTunel - Servicio de Tunelización Localhost a Red Pública

Plataforma completa de proxy inverso y tunelización segura (alternativa a ngrok / LocalTunnel) construida en Node.js con modelo de negocio **Freemium**, sistema de créditos semanales recargables y suscripciones Premium vía Stripe.

---

## 🏗️ Arquitectura del Sistema

El monorepo está organizado en workspaces independientes:

```
tuneling-para-todos/
├── apps/
│   ├── control-plane/     # Backend REST API (Auth JWT, Créditos Semanales, Webhook Stripe, MongoDB)
│   ├── tunnel-proxy/      # Edge Server HTTP + WebSocket Gateway (Enrutamiento por subdominio)
│   └── cli/               # Binario ejecutable 'mitunel' para consola con TUI en tiempo real
├── packages/
│   └── common/            # Protocolo de multiplexación de peticiones y constantes compartidas
├── deployment/            # Configuración Nginx para SSL Wildcard (*.tudominio.com)
├── docs/                  # Guía de despliegue en servidor VPS
└── docker-compose.yml     # Orquestación de desarrollo y producción
```

---

## ⚡ Inicio Rápido (Local)

### 1. Requisitos
- Node.js 18+ o superior
- Docker y Docker Compose (para MongoDB)

### 2. Levantar MongoDB
```bash
docker compose up -d mongodb
```

### 3. Configurar Entornos
Copia los archivos `.env.example` en cada aplicación:
```bash
cp apps/control-plane/.env.example apps/control-plane/.env
cp apps/tunnel-proxy/.env.example apps/tunnel-proxy/.env
```

### 4. Iniciar Servicios
En terminales separadas o usando los scripts del monorepo:

```bash
# Terminal 1: Control Plane & Billing API (Puerto 4000)
npm run dev:control-plane

# Terminal 2: Edge Tunnel Proxy (Puerto 8080)
npm run dev:proxy
```

---

## 💻 Uso del Cliente CLI (`mitunel`)

### 1. Guardar API Token
```bash
node apps/cli/bin/mitunel.js authtoken tk_live_xxxxxxxxxxxxxxxxxxxxxxxx
```
*Esto guardará la credencial de forma segura en `~/.mitunelrc`.*

### 2. Exponer un servicio local (ej. puerto 3000)
```bash
node apps/cli/bin/mitunel.js http 3000
```
La consola mostrará la URL pública asignada y un panel en tiempo real con las peticiones entrantes:
```
========================================================================
  🚇  MiTunel CLI  -  Localhost Reverse Proxy Gateway  [ FREE TIER ]
========================================================================
  Estado:           ● En Línea
  Túnel Público:    http://a1b2c3d4.mitunel.dev:8080
  Servicio Local:   http://localhost:3000
  Subdominio:       a1b2c3d4
  Créditos:         100 restantes esta semana
------------------------------------------------------------------------
  HISTORIAL DE PETICIONES HTTP EN TIEMPO REAL:
  HORA       MÉTODO   ESTADO   DURACIÓN   RUTA
  12:05:01   GET      200      12ms       /api/users
  12:05:04   POST     201      28ms       /api/login
========================================================================
```

### 3. Subdominios Fijos (Plan Premium)
Los usuarios Premium pueden solicitar subdominios fijos o personalizados:
```bash
node apps/cli/bin/mitunel.js http 3000 --subdomain mi-app
```

---

## 💳 Modelo Freemium y Facturación

1. **Free Tier:**
   - 100 créditos semanales asignados de forma automática.
   - Restablecimiento automático mediante Cron Job cada **7 días a las 00:00 UTC**.
   - Al agotarse los créditos, el proxy responde con `HTTP 402 Payment Required` y el CLI muestra un aviso con enlace de actualización.

2. **Premium Tier ($/mes vía Stripe):**
   - Créditos y horas de conexión ilimitadas.
   - Reserva de subdominios fijos garantizados (`mi-empresa.tudominio.com`).
   - Gestión de suscripción vía Stripe Customer Portal.

---

## 🌐 Despliegue en Producción (VPS)

Consulta la [Guía Completa de Despliegue en VPS](./docs/VPS_DEPLOYMENT_GUIDE.md) para configurar:
- Registros DNS Wildcard (`*.tudominio.com`).
- Certificados SSL Wildcard gratuitos con Let's Encrypt / Certbot.
- Terminador SSL y proxy inverso de alto rendimiento con Nginx.
