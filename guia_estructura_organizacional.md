# 🏢 Módulo de Estructura Organizacional — Guía Completa

## ¿Qué es?

El módulo de **Estructura Organizacional** es el "organigrama digital" de tu empresa dentro de AsistePro. Te permite definir cómo está organizada tu empresa: qué áreas existen, qué cargos hay, quién depende de quién y cómo se agrupan los costos.

---

## ¿Para qué sirve?

| Beneficio | Ejemplo práctico |
|---|---|
| Organizar empleados por departamento | Juan pertenece al Departamento de Ventas |
| Definir jerarquías claras | María es supervisora de Pedro |
| Asignar cargos formales | Carlos ocupa el cargo de "Analista de RRHH" |
| Agrupar costos por área | Los gastos de Marketing se cargan al centro de costo CC-MKT |
| Generar reportes precisos | Ver horas trabajadas solo del área de Logística |

---

## Tipos de nodos disponibles

El módulo maneja 6 tipos de elementos que puedes crear:

| Tipo | Icono | Descripción |
|---|---|---|
| **Dirección** | 🏛️ | El nivel más alto. Ej: "Gerencia General", "Presidencia" |
| **Departamento** | 🏢 | Agrupación principal de trabajo. Ej: "Ventas", "Operaciones", "RRHH" |
| **Área** | 📋 | Subdivisión de un departamento. Ej: "Área de Reclutamiento" dentro de RRHH |
| **Unidad** | 📌 | Grupo más pequeño dentro de un área. Ej: "Unidad de Nómina" |
| **Cargo** | 👤 | El puesto o rol de un empleado. Ej: "Analista Senior", "Supervisor de Turno" |
| **Centro de Costo** | 💰 | Agrupador contable. Ej: "CC-VENTAS", "CC-PRODUCCION" |

---

## Ejemplo Real: Empresa "Distribuidora ABC"

```
📁 Distribuidora ABC
│
├── 🏛️ Gerencia General
│   │
│   ├── 🏢 Departamento de Ventas
│   │   ├── 📋 Área de Ventas Nacionales
│   │   │   └── 👤 Vendedor Externo
│   │   └── 📋 Área de Ventas Online
│   │       └── 👤 Ejecutivo de Ecommerce
│   │
│   ├── 🏢 Departamento de Operaciones
│   │   ├── 📋 Área de Logística
│   │   │   └── 👤 Operador de Bodega
│   │   └── 📋 Área de Transporte
│   │       └── 👤 Conductor de Ruta
│   │
│   └── 🏢 Departamento de RRHH
│       ├── 📋 Área de Reclutamiento
│       │   └── 👤 Analista de Selección
│       └── 📌 Unidad de Nómina
│           └── 👤 Especialista en Nómina
│
├── 💰 Centro de Costo: CC-VENTAS
├── 💰 Centro de Costo: CC-LOGISTICA
└── 💰 Centro de Costo: CC-RRHH
```

---

## ¿Cómo se conecta con los empleados?

Cuando creas o editas un empleado, puedes asignarle:

- **Área estructurada** → El departamento/área donde trabaja
- **Cargo estructurado** → Su posición formal en el organigrama
- **Centro de costo** → El grupo contable al que pertenece
- **Supervisor** → Quién es su jefe directo

### Ejemplo:
> **Pedro Sánchez** trabaja en:
> - Área: `Área de Logística`
> - Cargo: `Operador de Bodega`
> - Centro de Costo: `CC-LOGISTICA`
> - Supervisor: `María Gómez (Jefa de Logística)`

---

## ¿Cómo se usa paso a paso?

### Paso 1 — Crea la estructura base
Ve a **Organización → Estructura** y comienza creando:
1. Una **Dirección** (la cúspide de tu organigrama)
2. Los **Departamentos** principales
3. Las **Áreas** dentro de cada departamento (si las necesitas)

### Paso 2 — Define los cargos
Crea los **Cargos** que existen en tu empresa (independientes del área, para que puedas reutilizarlos).

### Paso 3 — Define los centros de costo (opcional)
Si tu empresa lleva contabilidad por centros de costo, crea los grupos aquí.

### Paso 4 — Asigna a los empleados
Al registrar o editar cada empleado, selecciona el **Área**, **Cargo** y **Centro de Costo** correspondiente.

---

## Diferencia entre "Cargo libre" y "Cargo estructurado"

| Campo | Qué es | Ejemplo |
|---|---|---|
| **Cargo libre** | Texto libre que puedes escribir manualmente | "Asistente contable junior" |
| **Cargo estructurado** | Cargo formal del organigrama, definido en Estructura | Cargo: `Analista Contable` (creado en el módulo) |

> 💡 El cargo libre es para uso rápido. El cargo estructurado es para reportes, organigrama y trazabilidad formal.

---

## ¿Cuándo usar el módulo de Estructura?

✅ **Sí usar cuando:**
- Tu empresa tiene varios departamentos y quieres reportes por área
- Necesitas definir claramente quién reporta a quién
- Quieres llevar control de costos por departamento
- Generas documentos formales (solicitudes de permiso, vacaciones)

⚠️ **No es obligatorio si:**
- Tienes una empresa pequeña de 1-5 personas y no necesitas jerarquías
- Prefieres usar solo "Cargo libre" y "Departamento libre" en el formulario del empleado

---

## Preguntas frecuentes

**¿Puedo tener un cargo asignado a varios empleados?**
Sí. Un cargo como "Vendedor" puede estar asignado a 10 empleados al mismo tiempo.

**¿Si no asigno estructura a un empleado, pasa algo malo?**
No. El empleado funciona normalmente. La estructura es para organización y reportes, no es obligatoria para el marcado de asistencia.

**¿El organigrama se puede exportar?**
Actualmente se visualiza en pantalla. Próximamente se planea exportación a PDF.
