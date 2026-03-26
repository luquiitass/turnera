# Turnera - Sistema de Reserva de Turnos para Barberias

## Estado: DESARROLLO - MVP FUNCIONAL
**Plataformas:** Android / iOS / Web / Desktop (via Ionic + Capacitor)

---

## 1. MODELO DE NEGOCIO

Plataforma multi-barberia donde:
- Cada barberia tiene barberos, servicios, horarios y configuracion propia.
- Los servicios son un catalogo global compartido. Cada barberia elige cuales ofrece y define su precio/duracion.
- Cada barberia tiene su propio slug y subdominio (ej: `barber-12.turnera.es`).
- Un **Admin General** gestiona toda la plataforma.

### Modelo de monetizacion (los 3 disponibles):
- **Comision:** porcentaje por cada reserva.
- **Suscripcion:** cuota mensual por barberia.
- **Gratuito:** sin costo (freemium).

---

## 2. ROLES Y PERMISOS

| Rol | Permisos | Acceso UI |
|---|---|---|
| **Admin General** | Todo el sistema. Alta barberias, admins, ordenes de registro. | Dashboard plataforma, gestion barberias/usuarios, generar ordenes |
| **Admin de Barberia** | Gestion completa de su barberia: barberos, servicios, horarios, precios, pagos, ofertas, amenidades, config. | Dashboard barberia, panel admin en client-app |
| **Sub-admin** | Operativo: registrar/eliminar reservas, registrar pagos. | Dashboard barberia limitado |
| **Barbero** | Ver su agenda, agregar turnos rapidos, bloquear horarios, gestionar perfil/portfolio. | Agenda en "Mis Turnos", perfil de barbero |
| **Usuario registrado** | Ver barberia, reservar, cancelar, dejar resenas. Login con Google. | Tabs: Inicio, Mis Turnos, Perfil |
| **Visitante (sin cuenta)** | Ver barberia, servicios, barberos. No puede reservar. | Solo lectura en endpoints @Public |

### Asociaciones:
- Barbero esta asociado a un usuario registrado (por email).
- Admin de barberia se asigna al crear la barberia (por email o por orden de registro).

---

## 3. GESTION DE BARBERIAS

- Admin General da de alta barberias asignando un admin (por email).
- Sistema de **ordenes de registro**: Admin General genera un codigo → enlace con codigo → usuario inicia sesion → registra su barberia.
- **Slug unico** auto-generado desde el nombre (ej: "Barber 12" → `barber-12`).
- **Nombre unico** por barberia (constraint en BD).
- Cada barberia tiene:
  - Nombre (unico), slug (unico), direccion, ubicacion (lat/lng), telefono.
  - Fotos: portada y logo (URL).
  - Descripcion.
  - Configuracion: depositAmount (sena), cancellationHours, minAdvanceHours, maxAdvanceDays.
  - Medios de pago habilitados.
  - Modelo de negocio (comision/suscripcion/gratuito).
  - maxBarbers (limite de barberos configurable).

---

## 4. GESTION DE BARBEROS

- Admin de barberia agrega barberos por email de usuario registrado.
- Datos del barbero se toman automaticamente del perfil del usuario (nombre, avatar, telefono).
- Al agregar barbero se pueden asignar servicios que ofrece.
- Cada barbero tiene:
  - Nombre, apellido, bio, avatar, telefono.
  - Servicios asignados (si no tiene, ofrece todos).
  - Horarios configurables por dia.
  - Portfolio (galeria de fotos de trabajos).
  - Resenas de clientes.

---

## 5. SERVICIOS (CATALOGO GLOBAL)

- Servicios son globales: nombre unico validado con UPPERCASE.
- Cualquier admin puede crear un servicio nuevo al catalogo.
- Solo Admin General puede eliminar/desactivar servicios globales.
- Cada barberia activa los servicios que ofrece con su propio precio y duracion.
- Tabla intermedia `BarbershopService` (barbershopId, serviceId, price, durationMin).
- Tabla `BarberService` para asociar barbero con servicio especifico.

---

## 6. AMENIDADES / CARACTERISTICAS

- Sistema flexible: predefinidas + custom.
- 10 predefinidas: Calefaccion, Aire acondicionado, WiFi, Estacionamiento, TV, Musica, Cafe/Bebidas, Accesibilidad, Bano, Cargador celular.
- Admin puede crear amenidades custom.
- Toggle para activar/desactivar por barberia.
- Cada amenidad tiene: nombre (unico), icono (Ionicons), categoria, isDefault.

---

## 7. HORARIOS Y TURNOS

- Configuracion por barbero y dia de la semana.
- **Cada dia puede tener horario diferente** (Lun 9-19, Mar 10-20, Sab 9-14, Dom no trabaja).
- **Atajos**: "Aplicar L-V" (mismo horario lunes a viernes), "Todos los dias" (mismo horario 7 dias).
- Editor visual overlay con toggle por dia + inputs de hora desde/hasta.
- Campos: openTime, closeTime, slotDurationMinutes (default 30).
- **Bloqueos manuales**: barbero puede bloquear horario especifico (fecha, hora inicio/fin, motivo).
- **Disponibilidad calculada en tiempo real**: genera slots, resta bookings y bloqueos.
- **Horarios pasados no se muestran** en el dia actual.

---

## 8. RESERVAS

### Flujo de reserva - 4 metodologias:

**Por fecha:**
1. Elegir fecha (+ filtro de hora opcional)
2. Elegir servicio (catalogo global)
3. Elegir barberia (que ofrece ese servicio, con precio)
4. Elegir barbero (filtrado por servicio)
5. Elegir hora
6. Confirmar

**Por barberia** (desde detalle):
1. Elegir barbero
2. Elegir fecha
3. Elegir servicio
4. Elegir hora
5. Confirmar

**Por barbero** (preseleccionado):
1. Elegir fecha
2. Elegir servicio
3. Elegir hora
4. Confirmar

**Por servicio:**
1. Elegir servicio (catalogo global)
2. Elegir barberia (que lo ofrece, con precio)
3. Elegir barbero
4. Elegir fecha
5. Elegir hora
6. Confirmar

### Auto-skip de pasos:
- Si hay solo 1 barbero → se asigna y salta al siguiente paso.
- Si hay solo 1 servicio → se asigna y salta.
- Si hay solo 1 barberia → se asigna y salta.
- Al volver atras tambien salta los pasos auto-asignados.

### Validaciones backend:
- Slot no ocupado ni bloqueado.
- Usuario no tenga reserva en el mismo horario.
- Anticipacion minima/maxima de la barberia.
- Barbero ofrece el servicio (si no tiene asignados = ofrece todos).
- Barberia ofrece el servicio (BarbershopService).
- No se puede reservar en un horario pasado.

### Cancelacion:
- Usuario: hasta X horas antes (configurable por barberia, default 12hs).
- Admin/Sub-admin: sin restriccion de tiempo.
- No hay reprogramacion. Se cancela y crea nueva.

### Reservas recurrentes:
- Mismo dia y hora cada semana.
- Cancelar fecha especifica o toda la recurrencia.
- Genera instancias para 4 semanas futuras.

### Turno rapido (barbero):
- Desde la agenda, el barbero puede agregar turno seleccionando servicio + hora + nombre del cliente.
- Se asocia al user del barbero con datos del cliente en notas.

---

## 9. OFERTAS

- Por barberia, con fecha inicio y fin.
- Descuento porcentual o monto fijo.
- Aplica a todos o a servicios/barberos especificos (arrays serviceIds, barberIds).
- Horario especifico opcional (startTime/endTime).
- Creacion en 3 pasos: datos basicos → fechas → alcance (servicios + barberos).

---

## 10. PAGOS

- **Sena:** monto fijo configurable por barberia. Se cobra al reservar.
- **Saldo:** se paga en el local. Admin/sub-admin registra: monto, metodo, tipo.
- Metodos: EFECTIVO, TRANSFERENCIA, TARJETA_LOCAL, MERCADOPAGO.
- Resumen de reserva: total, sena, pagado, pendiente.
- Reembolso disponible (status REEMBOLSADO).

---

## 11. RESENAS

- 1 resena por usuario por barberia (unique constraint).
- Rating 1-5 + comentario.
- Resenas opcionales por barbero (barberId en Review).
- Estadisticas: promedio, total, distribucion por estrellas.

---

## 12. AUTENTICACION

### Client-app (usuarios finales):
- **Solo Google OAuth** (Google Identity Services SDK).
- Auto-registro: si el email no existe, se crea el usuario automaticamente con datos de Google.
- Si el usuario ya existe, se vincula la cuenta de Google.

### Admin-app:
- Login con email/password.
- Login con Google OAuth.
- Opcion "Recordar mis datos".

### Comun:
- JWT: access token (24h) + refresh token (30d).
- Auto-refresh: interceptor HTTP renueva el token si recibe 401.
- Recuperacion de contrasena por email (scaffold).
- Bcrypt 12 rounds para hashing.

---

## 13. SISTEMA DE SUBDOMINIOS

### Mecanica:
- Cada barberia tiene un `slug` unico (auto-generado del nombre).
- La client-app resuelve la barberia por subdominio: `barber-12.localhost:8200` → busca slug `barber-12`.
- Sin subdominio → dominio base para login y lista de barberias.

### Flujo de autenticacion con subdominios:
1. `barber-12.localhost:8200` → click "Ingresar"
2. Redirige a `localhost:8200/auth/login?redirect=barber-12` (dominio base, registrado en Google Console)
3. Login con Google
4. Redirige a `barber-12.localhost:8200/tabs/home#auth=tokens` (tokens en hash)
5. La app consume los tokens del hash y los guarda en localStorage

### Logout:
- Limpia tokens → redirige a `localhost:8200/auth/login?redirect=barber-12`

### Ordenes de registro:
1. Admin General genera codigo (8 chars, expira en 7 dias, un solo uso)
2. Enlace: `localhost:8200/auth/login?redirect=create-barber&code=CODIGO`
3. Usuario inicia sesion → formulario de alta de barberia (valida codigo)
4. Registra barberia → redirige a `nueva-barber.localhost:8200`

### Produccion:
- `barber-12.turnera.es` → `turnera.es/auth/login?redirect=barber-12`

---

## 14. NOTIFICACIONES

- Push (Firebase Cloud Messaging), Email (scaffold).
- Eventos: confirmacion reserva, recordatorio, cancelacion, nueva reserva (admin).

---

## 15. ESTADISTICAS

### Dashboard Admin Barberia:
- Reservas hoy / ingresos hoy.
- Reservas mes / ingresos mes / cancelaciones.
- Barberos activos, rating promedio.

### Reportes detallados:
- Reservas por barbero.
- Ingresos por medio de pago.
- Horarios mas demandados.
- Top usuarios.
- Filtros por rango de fechas.

### Dashboard Plataforma (Admin General):
- Barberias totales/activas, usuarios, reservas, ingresos.

---

## 16. INTERFAZ DE USUARIO

### Admin-app (app/) - Puerto 8100:
- **Admin General:** Dashboard plataforma inline (stats + acciones rapidas), gestionar barberias, usuarios, generar ordenes de registro.
- **Admin Barberia:** Lista de barberias asignadas → detalle con panel admin (barberos, servicios, horarios, ofertas, amenidades, config).
- **Sub-admin:** Panel limitado de barberia.
- **Usuario:** Home con reservas proximas, buscar, mis reservas con detalle/cancelar, perfil.
- **Barbero:** Perfil de barbero (foto, bio, portfolio, resenas, stats).

### Client-app (client-app/) - Puerto 8200:
- **Inicio:** Perfil de barberia (hero, amenidades, info, ofertas, servicios, barberos, resenas). Panel admin desplegable si es admin.
- **Mis Turnos:**
  - Cliente: lista con filtro (proximas/pasadas/todas), detalle, cancelar.
  - Barbero: agenda del dia (timeline con turnos/bloques/libres), agregar turno rapido, bloquear horario.
- **Perfil:** datos del usuario, logout.
- **Reservar:** wizard de 4 pasos (servicio → barbero → fecha/hora → confirmar). Auto-skip si 1 opcion.
- **Login:** Solo Google. Con slug muestra nombre de barberia. Sin slug muestra "Turnera".
- **Lista de barberias:** despues del login sin slug, lista para elegir y redirigir al subdominio.
- **Registro de barberia:** formulario con validacion de codigo de orden.
- **Pull to refresh** en todas las pantallas principales.

### Tabs:
- **Admin-app:** Inicio, Buscar, Reservas, Perfil, Rol (segun rol activo).
- **Client-app sin sesion:** Inicio, Ingresar.
- **Client-app con sesion:** Inicio, Mis Turnos, Perfil.

---

## 17. STACK TECNOLOGICO

| Capa | Tecnologia | Version |
|---|---|---|
| **Backend** | NestJS (TypeScript) | NestJS 11 |
| **ORM** | Prisma | 7.x (prisma-client-js + @prisma/adapter-pg) |
| **Base de datos** | PostgreSQL | 17 (Homebrew) |
| **Frontend Admin** | Ionic + Angular | Angular 20, Ionic 8 |
| **Frontend Client** | Ionic + Angular | Angular 20, Ionic 8 |
| **Autenticacion** | Passport + JWT + Google OAuth | passport-jwt, google-auth-library |
| **Google Login** | Google Identity Services SDK | GIS (script en index.html) |
| **Validacion** | class-validator + class-transformer | |
| **Pasarela de pago** | MercadoPago (preparado) | |
| **Push notifications** | Firebase Cloud Messaging (preparado) | |
| **Mobile** | Capacitor | |

---

## 18. ARQUITECTURA

### Estructura del proyecto:
```
reserva-barber/
├── api/                         # Backend NestJS
├── app/                         # Frontend Admin (Ionic/Angular)
├── client-app/                  # Frontend Cliente (Ionic/Angular)
└── CLOUDE.md                    # Este archivo
```

### Backend (api/)
```
api/
├── prisma/
│   ├── schema.prisma            # 23 entidades, enums, relaciones
│   └── seed.ts                  # Datos de prueba
├── src/
│   ├── main.ts                  # Bootstrap: CORS, ValidationPipe, prefix /api
│   ├── app.module.ts            # Imports + Guards globales (JWT + Roles)
│   ├── prisma/                  # PrismaModule (global) + PrismaService (pg adapter)
│   ├── common/
│   │   ├── decorators/          # @Roles(), @CurrentUser(), @Public()
│   │   ├── guards/              # JwtAuthGuard, RolesGuard, BarbershopOwnershipGuard
│   │   ├── interceptors/        # TransformInterceptor (envelope {success, data, timestamp})
│   │   ├── filters/             # HttpExceptionFilter global
│   │   └── types/               # PaginatedResponse, PaginationQuery
│   └── modules/                 # 14 modulos
│       ├── auth/                # register, login, google, refresh, forgot/reset-password, profile
│       ├── users/               # CRUD, perfil, asignar rol
│       ├── barbershops/         # CRUD, busqueda, admins, by-slug
│       ├── barbers/             # CRUD, servicios, imagenes, my-profile, my-agenda
│       ├── services/            # Catalogo global + BarbershopService
│       ├── schedules/           # Horarios, bloqueos, disponibilidad
│       ├── bookings/            # Crear, cancelar, recurrentes, historial
│       ├── payments/            # Registrar, resumen, reembolso
│       ├── amenities/           # CRUD, toggle, seed-defaults
│       ├── offers/              # CRUD, multi-servicio/barbero
│       ├── reviews/             # CRUD, stats, por barbero
│       ├── stats/               # Dashboard barberia, plataforma, reportes
│       └── registration/        # Ordenes de registro, validar codigo, registrar barberia
```

### Frontend Admin (app/)
```
app/src/app/
├── core/
│   ├── interceptors/            # AuthInterceptor (JWT + auto-refresh 401)
│   ├── guards/                  # AuthGuard, GuestGuard, RoleGuard
│   └── services/                # AuthService, StorageService
├── shared/models/               # Interfaces TypeScript
├── services/                    # HTTP services (barbershops, barbers, services, schedules, bookings, amenities, reviews)
└── pages/
    ├── auth/                    # Login (email+password+remember), Register
    ├── tabs/                    # Home (dashboard por rol), Search, My-Bookings, Profile
    ├── barbershop-detail/       # Detalle + panel admin (barberos, servicios, horarios, ofertas, amenidades, config)
    ├── booking-flow/            # Wizard 4 modos (fecha, barberia, barbero, servicio)
    ├── barber-profile/          # Perfil de barbero (foto, portfolio, resenas, stats)
    └── admin/                   # Platform-panel, Barbershop-panel, Manage-barbershops, Manage-users
```

### Frontend Cliente (client-app/)
```
client-app/src/app/
├── core/
│   ├── auth.service.ts          # Login Google, JWT, logout con slug
│   ├── auth.interceptor.ts      # JWT + auto-refresh
│   ├── auth.guard.ts            # Proteccion de rutas
│   ├── storage.service.ts       # LocalStorage wrapper
│   ├── api.service.ts           # Todos los endpoints centralizados (barbershopId del environment)
│   └── barbershop-resolver.service.ts  # Resuelve barberia por subdominio al iniciar
├── environments/
│   ├── environment.ts           # apiUrl, baseDomains, fallbackSlug
│   └── environment.prod.ts
└── pages/
    ├── login/                   # Solo Google OAuth (GIS SDK), manejo de redirect+code
    ├── register/                # Registro manual (email/password)
    ├── barbershop-list/         # Lista de barberias post-login sin slug
    ├── create-barber/           # Registro de barberia con codigo de orden
    ├── booking/                 # Wizard 4 pasos (servicio → barbero → fecha/hora → confirmar)
    └── tabs/
        ├── home/                # Perfil barberia + panel admin desplegable
        ├── bookings/            # Mis turnos (cliente) / Agenda (barbero)
        └── profile/             # Perfil usuario + logout
```

---

## 19. MODELO DE DATOS (23 entidades)

| Entidad | Descripcion | Relaciones clave |
|---|---|---|
| User | Usuarios (todos los roles) | 1:N BarbershopAdmin, 1:N Barber, 1:N Booking, 1:N Review |
| Barbershop | Barberia (nombre y slug unicos) | 1:N Barber, 1:N BarbershopService, 1:N Review, 1:N Offer |
| BarbershopAdmin | Relacion usuario-barberia con rol | N:1 User, N:1 Barbershop |
| Barber | Barbero (asociado a user por email) | N:1 Barbershop, N:1 User, 1:N BarberService, 1:N Schedule |
| BarberImage | Foto de portfolio | N:1 Barber |
| Service | Catalogo global (nombre unico UPPERCASE) | 1:N BarbershopService, 1:N BarberService |
| BarbershopService | Servicio activado en barberia (precio, duracion) | N:1 Barbershop, N:1 Service |
| BarberService | Servicio que ofrece un barbero | N:1 Barber, N:1 Service |
| Amenity | Caracteristica (nombre unico, predefinida o custom) | 1:N BarbershopAmenity |
| BarbershopAmenity | Caracteristica activada en barberia | N:1 Barbershop, N:1 Amenity |
| Schedule | Horario por barbero y dia | N:1 Barber (unique barberId+dayOfWeek) |
| BlockedSlot | Bloqueo manual de horario | N:1 Barber |
| Booking | Reserva individual | N:1 User, N:1 Barber, N:1 Service |
| RecurringBooking | Plantilla recurrencia semanal | 1:N Booking, 1:N BookingException |
| BookingException | Fecha excluida de recurrencia | N:1 RecurringBooking |
| Payment | Pago (sena/saldo) | N:1 Booking |
| BarbershopPaymentMethod | Medio de pago habilitado | N:1 Barbershop |
| Offer | Oferta/descuento (multi-servicio/barbero) | N:1 Barbershop |
| Review | Resena (por barberia y opcionalmente por barbero) | N:1 User, N:1 Barbershop, N:1 Barber? |
| Notification | Notificacion | N:1 User |
| PlatformConfig | Config global key/value | - |
| BarbershopSubscription | Suscripcion activa | 1:1 Barbershop |
| RegistrationOrder | Orden de registro de barberia | code unico, expiracion, un solo uso |

### Enums:
- Role: ADMIN_GENERAL, ADMIN_BARBERSHOP, SUB_ADMIN, USUARIO
- BookingStatus: PENDIENTE, CONFIRMADA, CANCELADA, COMPLETADA, NO_SHOW
- PaymentType: SENA, SALDO
- PaymentMethodType: MERCADOPAGO, EFECTIVO, TRANSFERENCIA, TARJETA_LOCAL
- PaymentStatus: PENDIENTE, APROBADO, RECHAZADO, REEMBOLSADO
- BusinessModel: COMISION, SUSCRIPCION, GRATUITO
- DayOfWeek: LUNES, MARTES, MIERCOLES, JUEVES, VIERNES, SABADO, DOMINGO
- DiscountType: PORCENTAJE, MONTO_FIJO

---

## 20. CONFIGURACION Y EJECUCION

### Requisitos:
- Node.js 20+
- PostgreSQL 16+
- npm

### Setup:
```bash
# Backend
cd api
cp .env.example .env
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run start:dev              # http://localhost:3000/api

# Frontend Admin
cd app
npm install
ionic serve                    # http://localhost:8100

# Frontend Client
cd client-app
npm install
ionic serve --port=8200        # http://localhost:8200
                               # Subdominio: barber-12.localhost:8200
```

### Variables de entorno (.env):
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/barber_db"
JWT_SECRET="barber-jwt-secret-dev-2024"
JWT_EXPIRATION="24h"
JWT_REFRESH_SECRET="barber-refresh-secret-dev-2024"
JWT_REFRESH_EXPIRATION="30d"
GOOGLE_CLIENT_ID="tu-google-client-id.apps.googleusercontent.com"
PORT=3000
```

### Credenciales de prueba (seed):
| Rol | Email | Password |
|---|---|---|
| Admin General | admin@barber.app | 123456 |
| Admin Barberia | barberia@barber.app | 123456 |
| Sub-admin | encargado@barber.app | 123456 |
| Usuario | juan@email.com | 123456 |
| Usuario | maria@email.com | 123456 |

### Datos de prueba incluidos:
- 3 barberias (The Classic Cut, Urban Barber Studio, Don Bigote) con slugs
- 10 servicios globales (Corte Clasico, Barba, Fade, Color, etc.)
- 5 barberos con servicios y horarios L-S
- 10 amenidades predefinidas
- 2 ofertas activas
- Reservas de ejemplo con pagos
- 3 resenas

---

## 21. FORMATO DE RESPUESTA API

Todas las respuestas siguen el formato:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-03-26T..."
}
```

Errores:
```json
{
  "success": false,
  "error": { "message": "...", "statusCode": 400 },
  "timestamp": "2026-03-26T..."
}
```

---

## 22. SEGURIDAD

- JWT global (APP_GUARD): todas las rutas protegidas excepto @Public.
- RolesGuard global: verifica rol del token. ADMIN_GENERAL bypasea todo.
- BarbershopOwnershipGuard: verifica que admin pertenezca a la barberia.
- Passwords: bcrypt 12 rounds.
- ValidationPipe global: whitelist + forbidNonWhitelisted.
- CORS habilitado (origin: true para desarrollo).
- Validacion de conflicto de horario por usuario al crear reserva.
- No se muestran slots pasados en disponibilidad del dia actual.
- Ordenes de registro: codigo unico, expiracion, un solo uso.

---

## 23. PENDIENTES / ROADMAP

- [ ] Integracion MercadoPago (cobro sena online)
- [ ] Subida real de imagenes (Cloudinary/S3)
- [ ] Push notifications (Firebase Cloud Messaging)
- [ ] Email transaccional (confirmacion, recordatorio, cancelacion)
- [ ] Verificacion de email al registrarse
- [ ] Google Maps integrado en detalle barberia
- [ ] Exportacion de reportes PDF/Excel
- [ ] Tests unitarios y e2e actualizados
- [ ] Build para Android/iOS con Capacitor
- [ ] Deploy a produccion (Cloud Run / Railway)
- [ ] PWA service worker
- [ ] Configuracion de Google OAuth para subdominios (login centralizado)
- [ ] Sistema de notificaciones in-app
- [ ] Galeria de fotos de barberia (coleccion)
- [ ] Reprogramacion de turnos
- [ ] Pagina de terminos y condiciones
