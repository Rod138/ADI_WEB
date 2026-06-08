# ADI

## X-CORP

- Briseño Muñoz Joseph Dylan
- Estrada Sevillano Rodrigo
- García Piedra Edwin Leonardo
- González de Luna Luis Gerardo
- Ortiz Avila Miguel Angel

## Descripción general

ADI es un sistema web y móvil desarrollado para la administración de incidencias y recursos financieros en una torre habitacional. La documentación de esta versión integra dos componentes:

- La versión web/backend que ya existe en este repositorio.
- La documentación de tesina de la versión móvil ADI Mobile desarrollada con Expo.


## Introducción

La torre M forma parte de un condominio llamado Residencial del Parque, ubicado en Cobre 193, Colonia Popular Rastro, alcaldía Venustiano Carranza, Ciudad de México. La torre cuenta con 16 departamentos distribuidos en 9 pisos y contempla las figuras administrativas de residentes, tesorero y administrador.

Actualmente el administrador se dedica a reportar los gastos mensuales de la torre y a verificar el estado de las cuotas en coordinación con el tesorero. El tesorero lleva el registro de quiénes realizaron su pago en tiempo y forma, y reporta al administrador el estado de cuenta para determinar la disponibilidad de recursos. El residente reporta nuevas incidencias en la torre y sube sus comprobantes de cuotas.

Hoy en día, los reportes de incidencias se pierden con frecuencia porque se informan mediante WhatsApp o de manera verbal. Además, los residentes no pueden saber si se está dando seguimiento a la incidencia reportada, y el administrador debe consultar al tesorero para verificar el estado de cuenta de la torre y determinar el cumplimiento de pagos.

Como propuesta de mejora se plantea el desarrollo de un software con módulos de incidencias, para dar seguimiento sencillo a cada reporte, y un módulo de contabilidad para el seguimiento del cumplimiento de cuotas por departamento, en el que el residente pueda subir la evidencia de su pago y el administrador y tesorero puedan validar que la cuota se pagó en tiempo y forma.

## Problemática

La gestión de condominios residenciales enfrenta retos estructurales cuando los procesos administrativos dependen de medios informales y registros manuales. Este es el caso de la Torre M en Residencial del Parque. La torre cuenta con 16 departamentos distribuidos en 9 pisos, áreas comunes como estacionamiento, pasillos, escaleras, elevador, azotea y vestíbulo de acceso, además de un administrador y un tesorero como figuras responsables de su operación.

En materia de incidencias, los reportes sobre fallas en áreas comunes o necesidades de mantenimiento se gestionan a través de un grupo de WhatsApp o mediante avisos verbales entre residentes y administración. Este esquema informal provoca pérdida de información e imposibilidad de dar seguimiento a cada caso, ya que no se cuenta con registros que permitan conocer cuántas veces se ha reportado un mismo problema, cuánto tiempo transcurre entre el reporte y su resolución, ni si el personal de mantenimiento atendió cada incidencia en el tiempo esperado.

La gestión financiera presenta deficiencias igualmente relevantes. Los pagos de cuotas se realizan en efectivo o mediante transferencia bancaria, y sus registros se llevan manualmente en un cuaderno. Para verificar los pagos por transferencia, los residentes envían el comprobante a través del grupo de WhatsApp, sin que exista un mecanismo formal de confirmación o conciliación. En cuanto a la rendición de cuentas, el administrador comparte mensualmente mediante WhatsApp una plantilla de Reporte Financiero y un Reporte de Pago de Servicios; sin embargo, al tratarse de documentos elaborados manualmente y sin respaldo verificable, su contenido puede ser incompleto o manipulable. Además, ninguno de estos reportes ofrece una visión consolidada de los ingresos y egresos totales de la torre.

Ambas problemáticas convergen en un mismo efecto: la erosión de la confianza entre residentes y administración. La falta de trazabilidad en las incidencias y la opacidad en el manejo de la situación financiera generan un ambiente de incertidumbre que dificulta la convivencia y la toma de decisiones colectivas. Esta situación evidencia la necesidad de una solución tecnológica centralizada que integre la gestión de incidencias y el seguimiento financiero de la torre, ofreciendo transparencia, trazabilidad y eficiencia operativa a todos los actores involucrados.

## Justificación

Si bien el proceso administrativo actual opera sin el apoyo de un software, el medio informal utilizado para la comunicación de incidencias ocasiona que, con el paso del tiempo, los registros se extravíen o queden inaccesibles. Al centralizar el proceso de administración en el condominio, se puede propiciar la trazabilidad del ciclo de vida de las incidencias, así como la disponibilidad de la información, tales como el estado de cuenta de la torre. La implementación de estas características contribuye a una mayor transparencia en la administración, así como una menor dependencia del tesorero o el administrador para comunicar la información, ya que ésta se encuentra disponible en el sistema en todo momento.

Por parte del proceso de gestión financiera, la consulta de las cuotas pagadas mensualmente por los residentes se hace de manera tardada, debido a que el tesorero debe consultar el reporte financiero de la torre para informar al administrador sobre cuáles departamentos pagaron su cuota. Permitiendo que los residentes suban su comprobante de pago, sea de transferencia o depósito, al sistema para que el administrador o el tesorero los valide directamente, se puede reducir el tiempo que toma este proceso.

## Objetivos

### General

Desarrollar un sistema web y móvil que facilite la administración de recursos financieros e incidencias, provocando una centralización de datos que propicie una transparencia en el proceso de administración.

### Específicos

- Diseñar módulos de registro de incidencias, reportes y gestión de finanzas que centralicen la información relevante de los residentes de la torre y faciliten su consulta.
- Establecer roles de usuario y niveles de acceso para que se delimiten las funciones permitidas dentro del sistema, propiciando la seguridad de la información.
- Desarrollar una plataforma web y móvil para optimizar la administración financiera y el seguimiento de incidencias dentro de la torre.

## Alcance

El sistema ADI integra los siguientes módulos funcionales:

- Módulo de acceso: sistema de autenticación que gestiona el acceso mediante perfiles, entre los cuales destacan el administrador de torre y el tesorero, con privilegios específicos sobre su unidad.
- Módulo de usuarios: para el rol de administrador permite la creación, edición, eliminación y visualización de inmuebles y cuentas de los residentes, además de la edición de los datos de su cuenta. Para todos los usuarios se permite la edición del propio perfil, pudiendo editar nombre de pila, apellidos materno y paterno, correo electrónico, contraseña y número de celular.
- Módulo de incidencias: permite la trazabilidad de incidencias y la creación, visualización, modificación y seguimiento de cada reporte.
- Módulo de notificaciones: apartado en el cual se pueden consultar avisos de reportes de contabilidad, incidencias, actualizaciones del sistema y periodos de mantenimiento.
- Módulo de reportes: permite la generación de reportes para los residentes sobre los pagos mensuales de los diferentes departamentos.
- Módulo de contabilidad: enfocado en el registro manual de ingresos y egresos por parte del administrador y el tesorero, carga de comprobantes de pago de cuota mensual y seguimiento de pagos extemporáneos y adeudos pendientes de los residentes.
- Módulo de soporte: módulo enfocado en la corrección de errores, aplicación de parches de seguridad y liberación de actualizaciones que optimicen el rendimiento y la experiencia del usuario.

## Limitaciones

El sistema ADI está sujeto a las siguientes limitaciones:

- Implementación: el sistema será desarrollado únicamente para una de las trece torres del condominio.
- Versiones: el sistema web deberá ser operado desde navegadores basados en Chromium 60 y versiones futuras.
- Versiones: el sistema móvil deberá ser operado desde sistemas Android versión 5 y versiones futuras.
- Finanzas: el sistema no cuenta con pasarela de pagos.
- Finanzas: el sistema no verifica automáticamente los comprobantes de pago.

Estas limitaciones responden a la disponibilidad de recursos técnicos y financieros asignados al desarrollo del sistema, así como a la limitante de los conocimientos del equipo.

## Tecnologías utilizadas

### Framework y entorno de ejecución

| Tecnología | Versión | Uso |
|---|---:|---|
| Expo | SDK 52+ | Framework principal para desarrollo móvil multiplataforma |
| React Native | 0.76+ | Biblioteca base para componentes de interfaz |
| Expo Router | v4 | Enrutamiento basado en sistema de archivos |
| Node.js | 18+ | Entorno de ejecución para herramientas de desarrollo |

### Base de datos y backend

| Tecnología | Uso |
|---|---|
| Supabase | Base de datos PostgreSQL, autenticación y cliente en tiempo real |
| @supabase/supabase-js | Cliente JavaScript para interacción con Supabase |

### Almacenamiento de archivos

| Tecnología | Uso |
|---|---|
| Cloudinary | Almacenamiento y entrega de imágenes y archivos PDF, como comprobantes de cuota, imágenes de incidencias y evidencias de gastos |

### Navegación y UI

| Tecnología | Uso |
|---|---|
| @react-navigation/native | Navegación base |
| @react-navigation/bottom-tabs | Navegación por pestañas inferiores |
| @expo-google-fonts/outfit | Tipografía Outfit (400, 500, 600, 700, 800, 900) |
| @expo/vector-icons (Ionicons) | Iconografía |

### Persistencia de sesión

| Tecnología | Uso |
|---|---|
| expo-secure-store | Almacenamiento seguro del token de sesión y datos del usuario |
| @react-native-async-storage/async-storage | Almacenamiento del cliente Supabase |

### Seguridad

| Tecnología | Uso |
|---|---|
| bcryptjs | Hash y comparación de contraseñas con bcrypt (10 rondas de sal) |

### Selección de archivos y medios

| Tecnología | Uso |
|---|---|
| expo-image-picker | Selección de imágenes desde galería o cámara |
| expo-document-picker | Selección de archivos PDF |

### Generación y compartición de documentos

| Tecnología | Uso |
|---|---|
| expo-print | Generación de archivos PDF desde HTML, por ejemplo reportes financieros |
| expo-sharing | Compartición de archivos PDF generados |
| expo-asset | Carga de activos estáticos, como el logo para PDF |
| expo-file-system | Lectura de archivos locales, como el logo en base64 para PDF |

### API externa de soporte

| Tecnología | Uso |
|---|---|
| ADI-SOPORTE (REST API) | Gestión de tickets de soporte, FAQs, áreas y tipos de error. Desplegada en `EXPO_PUBLIC_API_URL` |

## Roles de usuario

El sistema contempla cuatro roles con distintos niveles de acceso:

| rol_id | Nombre | Descripción |
|---:|---|---|
| 1 | Residente | Puede reportar y consultar incidencias, subir comprobantes de cuota, consultar gastos y notificaciones |
| 2 | Tesorero | Hereda permisos del residente; además puede validar comprobantes, registrar pagos en efectivo, administrar cuotas y egresos |
| 3 | Administrador | Hereda permisos del residente; además puede gestionar departamentos y usuarios, administrar incidencias y configurar el fondo financiero |
| 4 | Tesorero y Admin | Combina los permisos de los roles 2 y 3 |

## Estructura del proyecto

```text
adi-mobile/
├── app/
│   ├── _layout.tsx                  # Layout raíz, carga de fuentes y AuthProvider
│   ├── index.tsx                    # Punto de entrada, verificación de sesión
│   ├── login.tsx                    # Pantalla de inicio de sesión
│   ├── forgot-password.tsx          # Recuperación de contraseña
│   ├── (tabs)/                      # Navegación principal por pestañas
│   │   ├── _layout.tsx              # Layout de tabs con NotificationsProvider
│   │   ├── home.tsx                 # Pantalla de inicio / menú de módulos
│   │   ├── notifications.tsx        # Centro de notificaciones
│   │   ├── help.tsx                 # FAQs y acceso a soporte
│   │   ├── profile.tsx              # Perfil del usuario
│   │   ├── change-password.tsx      # Cambio de contraseña
│   │   ├── change-phone.tsx         # Cambio de teléfono
│   │   └── change-email.tsx         # Cambio de correo electrónico
│   ├── (incidents)/                 # Módulo de incidencias
│   │   ├── _layout.tsx              # Layout con tabs (Incidencias / Crear)
│   │   ├── index.tsx                # Lista de incidencias con filtros
│   │   ├── create.tsx               # Formulario de nueva incidencia
│   │   ├── incident-detail.tsx      # Detalle de incidencia (vista residente)
│   │   ├── edit-incident.tsx        # Edición de incidencia (dueño, 24h)
│   │   └── admin-incident.tsx       # Panel de gestión para administrador
│   ├── (finance)/                   # Módulo financiero
│   │   ├── _layout.tsx              # Layout de navegación financiera
│   │   ├── index.tsx                # Menú de sub-módulos financieros
│   │   ├── recipes.tsx              # Mis cuotas (vista residente)
│   │   ├── expenses.tsx             # Gastos de la torre
│   │   ├── admin-recipes.tsx        # Tablón de cuotas (admin/tesorero)
│   │   ├── balance.tsx              # Estado de cuenta general
│   │   ├── admin-quota.tsx          # Configuración de fondo y cuota mensual
│   │   └── reports.tsx              # Reportes financieros + exportar PDF
│   ├── (departments)/               # Módulo de departamentos (solo admin)
│   │   ├── _layout.tsx              # Redirección si rol < 3
│   │   ├── index.tsx                # Lista de departamentos con filtros y toggle
│   │   ├── [id].tsx                 # Detalle y gestión de residentes de un depto
│   │   └── edit-user.tsx            # Edición de datos de un residente
│   └── (help)/                      # Módulo de soporte
│       ├── report-error.tsx         # Formulario de reporte de problema
│       ├── my-tickets.tsx           # Lista de tickets del usuario
│       └── ticket-detail.tsx        # Detalle de un ticket
├── components/
│   ├── IncidentCard.tsx             # Tarjeta de incidencia con acciones según rol
│   ├── InputField.tsx               # Campo de entrada reutilizable (tema dark/light)
│   ├── PrimaryButton.tsx            # Botón principal con variantes y animación
│   ├── LegalModal.tsx               # Modal base para contenido legal
│   ├── PrivacyPolicyContent.tsx     # Contenido de política de privacidad
│   ├── TermsAndConditionsContent.tsx# Contenido de términos y condiciones
│   └── ui/
│       ├── BackButton.tsx           # Botón de navegación hacia atrás
│       ├── FormPageHeader.tsx       # Encabezado de formularios con ícono
│       ├── ScreenHeader.tsx         # Encabezado de pantalla principal
│       ├── ScreenShell.tsx          # Contenedor base de pantalla (dark/light)
│       ├── SectionCard.tsx          # Tarjeta de sección (dark/light)
│       ├── StatusBanner.tsx         # Banner de estado (error/éxito/info/advertencia)
│       └── index.ts                 # Re-exportaciones de componentes UI
├── constants/
│   └── colors.ts                    # Sistema de colores del proyecto
├── context/
│   ├── AuthContext.tsx              # Contexto de sesión de usuario
│   └── NotificationsContext.tsx     # Contexto de notificaciones en tiempo real
├── hooks/
│   ├── useAuth.ts                   # Autenticación, login y recuperación de contraseña
│   ├── useBalance.ts                # Cálculo del balance financiero general
│   ├── useDepartments.ts            # Gestión de departamentos y usuarios
│   ├── useExpenses.ts               # Gestión de gastos de la torre
│   ├── useFaqs.ts                   # Preguntas frecuentes desde API externa
│   ├── useIncidents.ts              # CRUD de incidencias y catálogos
│   ├── useMonthlyQuota.ts           # Cuota mensual de mantenimiento
│   ├── useMyTickets.ts              # Tickets de soporte del usuario
│   ├── useNotificationSender.ts     # Envío de notificaciones por evento
│   ├── useNotifications.ts          # Lista de notificaciones y utilidades de creación
│   ├── useProfile.ts                # Actualización de contraseña, teléfono y correo
│   ├── useRecipes.ts                # Gestión de comprobantes de pago (cuotas)
│   ├── useTickets.ts                # Creación de tickets de soporte
│   └── useTowerFund.ts              # Fondo inicial de la torre
├── lib/
│   ├── supabase.ts                  # Configuración e instancia del cliente Supabase
│   ├── cloudinary.ts                # Subida de imágenes y PDFs a Cloudinary (ADI)
│   └── cloudinarySupport.ts         # Subida de imágenes a Cloudinary (módulo soporte)
├── utils/
│   ├── bcrypt.ts                    # Hash y comparación de contraseñas
│   ├── generateReportHTML.ts        # Generación de HTML para reportes PDF
│   ├── globalStyles.ts              # Estilos globales compartidos
│   └── validators.ts                # Validaciones de formularios (email, contraseña)
└── assets/
    └── images/
        ├── logo.png                 # Logotipo principal de ADI
        └── logoRP.png               # Logotipo de Residencial del Parque (para PDF)
```

## Variables de entorno

El proyecto requiere un archivo `.env` en la raíz con las siguientes variables:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

# Cloudinary — módulo principal (incidencias, cuotas, gastos)
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=

# Cloudinary — módulo de soporte (tickets)
EXPO_PUBLIC_SUPPORT_CLOUDINARY_CLOUD_NAME=
EXPO_PUBLIC_SUPPORT_CLOUDINARY_UPLOAD_PRESET=

# API de soporte ADI-SOPORTE
EXPO_PUBLIC_API_URL=
```

## Comandos disponibles

```bash
npm install
npm start
npm run android
npm run ios
npm run web
npm run lint
npm run reset-project
```

## Flujo de autenticación

- Al iniciar la app, `app/index.tsx` verifica si existe un token en `expo-secure-store`.
- Si el token existe, redirige a `/(tabs)/home`; de lo contrario, redirige a `/login`.
- En el login, se busca al usuario por correo en Supabase y se compara la contraseña ingresada contra el hash almacenado con `bcryptjs`.
- Al autenticarse correctamente, el token `user.id` y los datos de sesión se persisten en SecureStore.
- El `AuthProvider` restaura la sesión desde SecureStore al montar la aplicación.
- El cierre de sesión elimina el token y los datos de sesión del almacenamiento seguro.

## Sistema de notificaciones

Las notificaciones se gestionan a través de dos capas:

- `NotificationsContext`: proveedor que vive en el layout de tabs `app/(tabs)/_layout.tsx`. Provee el listado de notificaciones, el contador de no leídas, el badge en la pestaña Avisos y las funciones de marcar como leído, marcar todas, eliminar y eliminar todas. Las operaciones son optimistas: se aplican en memoria de forma inmediata y se persisten en Supabase de forma asíncrona.
- `useNotificationSender`: utilidades para crear notificaciones en respuesta a eventos del sistema.

| Tipo de evento | Destinatarios |
|---|---|
| Cambio de estado de incidencia | Residente que la reportó |
| Cuota mensual publicada | Todos los usuarios |
| Comprobante de cuota rechazado | Residentes del departamento |
| Comprobante de cuota aprobado | Residentes del departamento |
| Nuevo gasto registrado | Todos los usuarios |
| Nueva incidencia reportada | Administradores |
| Nuevo comprobante recibido | Tesoreros |

## Lógica de negocio destacada

### Módulo de incidencias

- Un residente puede editar su incidencia dentro de las primeras 24 horas desde su creación, siempre que esté en estado pendiente.
- Un residente puede eliminar su incidencia dentro de las primeras 2 horas, siempre que esté en estado pendiente.
- El administrador puede gestionar cualquier incidencia: cambiar su estado, asignar un costo estimado y agregar notas de resolución.
- Al marcar una incidencia como resuelta, se registra automáticamente la fecha de `completed_at`; al cerrarla, la de `closed_at`.

### Módulo de cuotas

- Los períodos disponibles para registrar y consultar cuotas están restringidos por la fecha de inicio del fondo (`tower_fund.updated_at`). Solo se habilitan meses desde esa fecha en adelante.
- El sistema aplica un recargo del 10% si el residente sube su comprobante después del día 15 del mes.
- Se permite el pago parcial: si el monto pagado es menor al esperado, el sistema lo identifica como parcial y permite registrar pagos adicionales hasta cubrir la cuota completa.
- El administrador puede registrar pagos en efectivo directamente, sin necesidad de comprobante.

### Módulo financiero

- El balance disponible se calcula como: fondo_inicial + ingresos_validados - gastos - costos_incidencias, todos contabilizados desde la fecha de inicio del fondo.
- Los reportes financieros mensuales se generan como HTML y se exportan a PDF mediante `expo-print`, incluyendo tabla de pagos por departamento, detalle de egresos y líneas de firma.

## Dependencias clave

```json
"expo": "~52.x",
"react-native": "0.76.x",
"expo-router": "~4.x",
"@supabase/supabase-js": "^2.x",
"@react-native-async-storage/async-storage": "^2.x",
"@react-navigation/native": "^7.x",
"@react-navigation/bottom-tabs": "^7.x",
"bcryptjs": "^2.4.x",
"expo-secure-store": "~14.x",
"expo-image-picker": "~16.x",
"expo-document-picker": "~12.x",
"expo-print": "~14.x",
"expo-sharing": "~12.x",
"@expo-google-fonts/outfit": "^0.x"
```

Nota: las versiones exactas se encuentran en `package.json`.

## Parte web y backend del repositorio actual

El repositorio actual incluye una implementación web/backend complementaria al sistema:

- `BackEnd/server.js` arranca un servidor Express con EJS y archivos estáticos de `FrontEnd/`.
- `BackEnd/routes.js` centraliza las rutas del sistema.
- `BackEnd/dbconfig.js` inicializa el cliente de Supabase usando variables de entorno.
- `BackEnd/utils/validation.js` contiene validaciones, bcrypt y generación/verificación de JWT.
- `package.json` incluye los scripts `start`, `dev` y `test`.

