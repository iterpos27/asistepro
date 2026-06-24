# Guía Detallada: Estructura Organizacional en AsistePro

El módulo de **Estructura Organizacional** es el pilar central del sistema multi-tenant de AsistePro. Permite modelar de forma precisa la jerarquía, distribución y relaciones de dependencias de la empresa, lo cual es fundamental para la asignación de permisos, la canalización de aprobaciones de solicitudes y la generación de reportes consolidados.

---

## 1. Tipos de Estructuras (Nodos)
El sistema permite organizar la empresa utilizando 6 tipos diferentes de nodos estructurales, clasificados de la siguiente manera:

1. **Dirección**: Representa el nivel más alto de la organización (ej. *Dirección General*, *Dirección Ejecutiva*).
2. **Departamento**: Agrupaciones generales de funciones operativas o administrativas (ej. *Departamento de Contabilidad*, *Departamento de Sistemas*).
3. **Área**: Divisiones especializadas dentro de un departamento (ej. *Área de Nómina*, *Área de Soporte Técnico*).
4. **Unidad**: Subdivisiones u oficinas funcionales de nivel menor (ej. *Unidad de Archivo*, *Unidad de Redes*).
5. **Cargo**: Define el puesto o rol profesional del empleado dentro de la estructura (ej. *Analista Contable*, *Desarrollador Fullstack*).
6. **Centro de Costo**: Dimensión financiera utilizada para clasificar los gastos de nómina y recursos por departamento u oficina (ej. *CC-Sistemas-001*).

---

## 2. Relaciones y Jerarquía (Relaciones Padre-Hijo)
El sistema soporta una estructura jerárquica flexible:
- A excepción de los *Cargos* y *Centros de Costo* (que actúan de forma más transversal), los nodos de tipo **Dirección, Departamento, Área y Unidad** pueden tener un **Padre (Parent ID)**.
- Esto permite establecer un árbol organizativo. Por ejemplo:
  `Dirección General (Padre)` ➔ `Departamento de Finanzas (Hijo)` ➔ `Área de Contabilidad (Hijo del Departamento)` ➔ `Unidad de Caja (Hijo del Área)`.
- El sistema utiliza esta jerarquía para:
  - **Estructura de Reportes**: Obtener reportes consolidados (ej. ver asistencia de todo un departamento incluyendo sus áreas hijas).
  - **Flujos de Aprobación**: Determinar a qué superiores enviar solicitudes en base a su ubicación en la estructura.

---

## 3. Asignación de Responsables (Supervisores)
Cada nodo de la estructura puede tener asignado un **Responsable (Supervisor)**:
- El responsable es un empleado activo del sistema.
- Cuando un empleado pertenece a un área o departamento específico, el sistema le asocia automáticamente al responsable de dicho nodo como su supervisor directo.
- Esto facilita la automatización en el flujo de solicitudes (vacaciones, permisos, corrección de marcaciones) sin necesidad de configurar supervisores de forma manual uno por uno.

---

## 4. Carga Masiva e Importación desde Excel
El módulo incluye un sistema de importación desde plantillas Excel:
- **Funcionamiento**: Permite subir un archivo de nómina con columnas estándar (`codigo`, `nombres`, `apellidos`, `sucursal_codigo`, `area_nombre`, `cargo_nombre`, etc.).
- **Resolución Automática**: Al procesar el archivo, el motor de importación en el backend:
  1. Busca la sucursal indicada y asocia al empleado.
  2. Si el Área o el Cargo indicados en la fila no existen en el catálogo de estructuras de la empresa, **los crea automáticamente** bajo el tipo correspondiente.
  3. Vincula al empleado con estas estructuras.
- **Historial de Importaciones**: Cada archivo cargado queda registrado en una bitácora mostrando el estado del proceso, el número de registros creados, los actualizados y los errores reportados (en formato JSON) si alguna fila falló en su validación.

---

## 5. El Botón "Editar" (Icono de Lápiz)
En la lista de **Estructuras activas**:
- Cada fila tiene un botón de **Acciones**.
- El primer botón (que anteriormente mostraba un icono `+` y ahora muestra un icono de **lápiz/editar ✏️**) carga la estructura seleccionada de vuelta al formulario de **"Nueva estructura"** (cambiando su título a **"Editar estructura"**).
- Al hacer esto, puedes corregir su código, nombre, tipo, descripción, o cambiar su nodo padre y su responsable, y luego guardar los cambios haciendo clic en **Actualizar**.
