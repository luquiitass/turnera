# Estado del Proyecto — Revisión Dev Mode
> Generado: 2026-04-22

---

## Estado Actual de Compilación

| Servicio | Puerto | Estado | Errores | Warnings |
|---------|--------|--------|---------|---------|
| **API** (NestJS watch) | 3000 | ✅ Running | 0 | 0 |
| **App** (Angular) | 4200 | ✅ Compiled | 0 | 1 |

---

## ⚠️ Warning Activo (1)

### W1 · NG8113 — Componente importado pero no usado en template

**Archivo:** `app/src/app/pages/admin/manage-barbershops/manage-barbershops.page.ts:13`

```
CreateBarbershopModalComponent is not used within the template of ManageBarbershopsPage
```

**Causa:** `CreateBarbershopModalComponent` está en el array `imports` del componente standalone pero no aparece como tag en el HTML. Se usa correctamente como argumento de `modalController.create()` — Angular no lo detecta como "uso en template".

**Solución posible:** Suprimir con `// eslint-disable-next-line @angular-eslint/no-unused-imports` (ya tiene un comentario similar).

**Impacto:** Ninguno funcional. Solo warning.

---

## ✅ Errores Resueltos Durante el Desarrollo (histórico)

Los siguientes errores aparecieron durante el proceso de fusión de `app/` + `client-app/` y fueron corregidos:

### Grupo 1 · Paths de environment incorrectos en servicios copiados de client-app

| Archivo | Error | Fix aplicado |
|---------|-------|-------------|
| `core/barbershop-resolver.service.ts` | `../../../../../environments/environment` (5 niveles) | `../../environments/environment` (2 niveles) ✅ |
| `core/client-api.service.ts` | idem | idem ✅ |
| `core/geolocation.service.ts` | idem | idem ✅ |
| `core/nearby-barbershops.service.ts` | idem | idem ✅ |
| `core/nominatim.service.ts` | idem | idem ✅ |
| `pages/client/*/` (depth 3) | `../../../../../environments` (5) en vez de `../../../../environments` (4) | Corregido ✅ |
| `pages/client/tabs/*/` (depth 4) | idem | Corregido ✅ |
| `pages/client/tabs/tabs-routing.module.ts` | `../../core/guards/auth.guard` en vez de `../../../core/guards/auth.guard` | Corregido ✅ |

### Grupo 2 · Dependencia faltante

| Archivo | Error | Fix aplicado |
|---------|-------|-------------|
| `core/geolocation.service.ts` | `@capacitor/geolocation` not found | `npm install @capacitor/geolocation` ✅ |

### Grupo 3 · barbershop-detail: referencias a campos eliminados del modelo

| Archivo | Error | Fix aplicado |
|---------|-------|-------------|
| `barbershop-detail.page.html` | `coverImage`, `logoImage` on Barbershop | Campos eliminados del modelo, reemplazados por `getBarbershopImage()` ✅ |
| `barbershop-detail.page.html` | `avatarUrl` on Barber | Eliminado, reemplazado por `getBarberImage()` ✅ |
| `barbershop-detail.page.html` | `imageUrl` on BarberImage | Cambiado a `image.url` ✅ |
| `barbershop-detail.page.html` | `uploadingImage` property | Renombrado a `uploadStatus` + `uploadingFor` ✅ |
| `barbershop-detail.page.html` | `getBarberGalleryUrls` pipe error | Se quitó el pipe, se usa método directo ✅ |
| `barbershop-detail.page.ts` | `editLocation` method not found | Agregado ✅ |
| `barbershop-detail.page.ts` | `openPlanManager` not found | Agregado ✅ |
| `barbershop-detail.page.ts` | `UploadEvent.id` | Cambiado a `UploadEvent.image!.id` ✅ |
| `barbershop-detail.page.ts` | `subscription` not on Barbershop model | Agregado al modelo compartido ✅ |

### Grupo 4 · booking-flow: referencias a `avatarUrl`

| Archivo | Error | Fix aplicado |
|---------|-------|-------------|
| `booking-flow.page.html:264` | `barber.avatarUrl` | Reemplazado por `barber.images?.[0]?.image?.url` ✅ |

### Grupo 5 · NominatimService conflicto

| Archivo | Error | Fix aplicado |
|---------|-------|-------------|
| `create-barbershop-modal.component.ts` | `NominatimService` not found | Recreado `core/nominatim.service.ts` con métodos `autocomplete()` y `reverseGeocode()` ✅ |
| `core/nominatim.service.ts` (client-app copy) | Conflicto de nombre | Renombrado a `ClientNominatimService` en `core/client-nominatim.service.ts` ✅ |

### Grupo 6 · manage-barbershops NG2012

| Archivo | Error | Fix aplicado |
|---------|-------|-------------|
| `manage-barbershops.page.ts` | `CreateBarbershopModalComponent` not standalone | Resuelto con `touch` para forzar recompilación ✅ |

### Grupo 7 · barbershop-list paths rotos

| Archivo | Error | Fix aplicado |
|---------|-------|-------------|
| `barbershop-list.page.ts` | Auth/storage/env paths incorrectos | Paths corregidos en script de fix_paths_for_depth ✅ |

---

## 🔧 Issues Funcionales Conocidos (post-compilación)

Estos no son errores de compilación sino issues de comportamiento identificados durante las pruebas:

| # | Issue | Página | Estado |
|---|-------|--------|--------|
| 1 | `status: 'CONFIRMED'` en vez de `'CONFIRMADA'` al filtrar turnos | Admin home | ✅ Corregido |
| 2 | `b.bookingDate` en vez de `b.date` en próxima reserva cliente | Client home | ✅ Corregido |
| 3 | `GuestGuard` redirigía a `/admin/tabs/home` para todos | Auth guard | ✅ Corregido (role-aware) |
| 4 | `loadStoredUser()` hacía logout en cualquier error de red | AuthService | ✅ Corregido (solo en 401) |
| 5 | `barbershopPlan` no cargaba porque usaba HTTP async sin esperar resolver | Booking cliente | ✅ Corregido (usa BarbershopResolverService) |
| 6 | `uploadingImage` vs `uploadStatus` en image manager | Barbershop detail | ✅ Corregido |
| 7 | Pago no se exigía a admins/barberos en modelo COMISION | Booking cliente | ✅ Corregido |

---

## 📋 Pendientes / Mejoras sugeridas

| # | Descripción | Prioridad |
|---|-------------|-----------|
| P1 | Página `/tabs/bookings` cache issue tras hot-reloads | Media |
| P2 | Warning NG8113 en manage-barbershops (suppressible) | Baja |
| P3 | Logs MP (`[MP] Creando preferencia...`) en producción deberían eliminarse | Media |
| P4 | Página `/tabs/home` sin geolocalización muestra vacío | Baja |
| P5 | `client-app/` puede archivarse (ya integrada en `app/`) | Baja |

---

## 🌐 URLs de desarrollo

| App | URL |
|-----|-----|
| API | http://localhost:3000/api |
| Admin | http://localhost:4200/admin/tabs/home |
| Cliente | http://localhost:4200/tabs/home |
| Login | http://localhost:4200/auth/login |
