export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  // Dominios base para resolver subdominio
  // En dev: barber-12.localhost:8200
  // En prod: barber-12.turnera.es
  baseDomains: ['localhost', 'turnera.es'],
  // Fallback si no se detecta subdominio
  fallbackSlug: 'barber-12',
  // Se resuelven dinámicamente al iniciar la app
  barbershopId: '',
  appName: 'Turnos',
};
