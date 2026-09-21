const { ERROR_CODES } = require('@mitunel/common');

class ControlPlaneClient {
  constructor() {
    this.baseUrl = process.env.CONTROL_PLANE_URL || 'http://localhost:4000';
    this.secret = process.env.INTERNAL_PROXY_SECRET || 'proxy_internal_secret_key_change_in_prod';
  }

  async validateTunnel(token, requestedSubdomain) {
    try {
      const response = await fetch(`${this.baseUrl}/api/internal/tunnels/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-proxy-secret': this.secret,
        },
        body: JSON.stringify({ token, requestedSubdomain }),
      });

      const data = await response.json();
      return {
        status: response.status,
        data,
      };
    } catch (error) {
      console.error(`[ControlPlaneClient Error]: No se pudo conectar al Control Plane: ${error.message}`);
      return {
        status: 500,
        data: {
          allowed: false,
          reason: ERROR_CODES.INTERNAL_ERROR,
          message: 'Error de comunicación con el Control Plane de autenticación',
        },
      };
    }
  }

  async reportUsage(usageData) {
    try {
      const response = await fetch(`${this.baseUrl}/api/internal/tunnels/usage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-proxy-secret': this.secret,
        },
        body: JSON.stringify(usageData),
      });

      const data = await response.json();
      if (!response.ok) {
        console.error(`[ControlPlaneClient Error] HTTP ${response.status} en reportUsage:`, data);
      }
      return data;
    } catch (error) {
      console.error(`[ControlPlaneClient Error] Error de conexión reportando consumo: ${error.message}`);
      return null;
    }
  }
}

module.exports = new ControlPlaneClient();
