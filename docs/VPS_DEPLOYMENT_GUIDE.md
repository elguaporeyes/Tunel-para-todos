# Guía de Despliegue en VPS con Certificado SSL Wildcard

Esta guía detalla paso a paso cómo desplegar la plataforma **MiTunel** en un servidor VPS (Ubuntu 22.04 / 24.04 LTS en Hetzner, DigitalOcean, AWS EC2, Linode o similar) con soporte completo para subdominios dinámicos `*.tudominio.com` y HTTPS.

---

## 1. Configuración de Registros DNS

Para que cualquier subdominio aleatorio o personalizado apunte automáticamente a tu VPS:

1. Ve al panel de control de tu proveedor de DNS (Cloudflare, Namecheap, GoDaddy, etc.).
2. Agrega los siguientes registros tipo **A**:

| Tipo | Nombre (Host) | Valor (Destino) | TTL | Proxy (Cloudflare) |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `@` | `<IP_PUBLICA_VPS>` | Auto / 300 | Solo DNS (Gris) |
| **A** | `*` (Wildcard) | `<IP_PUBLICA_VPS>` | Auto / 300 | Solo DNS (Gris) |
| **A** | `api` | `<IP_PUBLICA_VPS>` | Auto / 300 | Solo DNS (Gris) |

> [!IMPORTANT]
> Si utilizas Cloudflare, mantén el proxy en **DNS Only (nube gris)** para el registro `*` durante la emisión de certificados, o utiliza el plugin DNS de Cloudflare para Certbot.

---

## 2. Instalación de Dependencias en el Servidor VPS

Conéctate por SSH a tu servidor:
```bash
ssh root@<IP_PUBLICA_VPS>
```

Actualiza el sistema e instala Docker, Nginx y Certbot:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw nginx certbot python3-certbot-dns-cloudflare

# Instalar Docker y Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

Configura el Firewall (UFW):
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 3. Generación de Certificado SSL Wildcard con Let's Encrypt

Los certificados SSL Wildcard (`*.tudominio.com`) requieren validación por **DNS-01 Challenge** (crear un registro TXT en tu DNS).

### Opción A: Vía API de Cloudflare (Totalmente automatizada y auto-renovable)
1. Crea un token en Cloudflare con permisos de edición de DNS (`Zone.DNS:Edit`).
2. Guarda las credenciales en `/etc/letsencrypt/cloudflare.ini`:
```ini
dns_cloudflare_api_token = TU_CLOUDFLARE_API_TOKEN
```
3. Protege el archivo:
```bash
chmod 600 /etc/letsencrypt/cloudflare.ini
```
4. Solicita el certificado Wildcard:
```bash
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60 \
  -d tudominio.com \
  -d *.tudominio.com \
  --email tu-correo@ejemplo.com \
  --agree-tos \
  --no-eff-email
```

### Opción B: Modo Manual (Sin API de proveedor)
```bash
certbot certonly --manual --preferred-challenges dns \
  -d tudominio.com \
  -d *.tudominio.com \
  --email tu-correo@ejemplo.com \
  --agree-tos
```
*Certbot te pedirá que agregues un registro `_acme-challenge.tudominio.com` de tipo TXT en tu DNS y presiones Enter.*

Los certificados quedarán instalados en:
`/etc/letsencrypt/live/tudominio.com/fullchain.pem`
`/etc/letsencrypt/live/tudominio.com/privkey.pem`

---

## 4. Configurar Nginx como Reverse Proxy & Terminador SSL

1. Copia la plantilla de configuración provista en el repositorio:
```bash
sudo cp deployment/nginx-mitunel.conf /etc/nginx/sites-available/mitunel.conf
```

2. Edita `/etc/nginx/sites-available/mitunel.conf` y reemplaza `mitunel.dev` por tu dominio real (ej. `tudominio.com`).

3. Habilita el sitio y recarga Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/mitunel.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Despliegue de la Aplicación con Docker Compose

1. Clona tu repositorio en el VPS:
```bash
git clone https://github.com/tu-usuario/mitunel.git /opt/mitunel
cd /opt/mitunel
```

2. Configura las variables de entorno de producción:
```bash
cp apps/control-plane/.env.example apps/control-plane/.env
cp apps/tunnel-proxy/.env.example apps/tunnel-proxy/.env
```
*Edita las variables con tus credenciales reales de MongoDB, Stripe y contraseñas seguras.*

3. Inicia los servicios en segundo plano:
```bash
docker compose up -d --build
```

4. Verifica el estado de los contenedores:
```bash
docker compose ps
docker compose logs -f
```

---

## 6. Distribución del CLI a los Usuarios

Tus usuarios pueden instalar el CLI directamente vía npm o clonando el cliente:

```bash
npm install -g @mitunel/cli
```

O configurando su endpoint de producción:
```bash
mitunel authtoken tk_live_xxxxxxxxxxxxxxxxxxxxxxxx
mitunel http 3000 --server wss://tudominio.com
```

¡Tu plataforma de túneles multi-inquilino de producción está lista y operando con soporte HTTPS Wildcard!
