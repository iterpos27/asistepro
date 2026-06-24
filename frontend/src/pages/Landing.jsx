import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Laptop,
  MapPin,
  QrCode,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950 overflow-x-hidden">
      {/* Background Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-1/4 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Navigation */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/70 border-b border-slate-800 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <ShieldCheck size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight text-white bg-clip-text">
              Asiste<span className="text-emerald-400">Pro</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              Características
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              Cómo Funciona
            </a>
            <a href="#pricing" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              Planes y Precios
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="px-4 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/register"
              className="px-5 py-2.5 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-all duration-200 transform hover:-translate-y-0.5"
            >
              Probar Gratis
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-16 pb-24 lg:pt-24 lg:pb-32 flex flex-col lg:flex-row items-center gap-16">
        <div className="flex-1 text-center lg:text-left max-w-2xl lg:max-w-none">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-6 animate-pulse">
            <Sparkles size={14} />
            <span>Control de Asistencia SaaS de Siguiente Generación</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
            El control de asistencia <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
              inteligente y sin fraude
            </span>
          </h1>

          <p className="text-lg text-slate-400 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
            Valida los registros de tus empleados en tiempo real usando códigos QR dinámicos y geolocalización GPS. Configura horarios flexibles, gestiona reemplazos y automatiza el cálculo de nómina sin complicaciones.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all duration-200 group transform hover:-translate-y-0.5"
            >
              <span>Comenzar prueba gratuita</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto px-8 py-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-200"
            >
              Ver planes
            </a>
          </div>

          {/* Social Proof */}
          <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4">
            <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">Confiado por empresas de:</span>
            <div className="flex gap-6 text-sm font-semibold text-slate-400">
              <span>Ecuador</span>
              <span>•</span>
              <span>Colombia</span>
              <span>•</span>
              <span>Perú</span>
              <span>•</span>
              <span>Chile</span>
            </div>
          </div>
        </div>

        {/* Hero Interactive Mockup Graphic */}
        <div className="flex-1 w-full max-w-xl lg:max-w-none relative">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-teal-500/10 rounded-3xl filter blur-3xl opacity-80" />
          <div className="relative bg-slate-950/80 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-red-500/80" />
                <span className="w-3.5 h-3.5 rounded-full bg-yellow-500/80" />
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/80" />
              </div>
              <span className="text-xs font-semibold text-slate-500">asistepro.com/dashboard</span>
              <div className="w-8" />
            </div>

            {/* Dashboard Mockup Grid */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Activos hoy</span>
                  <span className="text-xl font-bold text-white">142 / 150</span>
                  <span className="text-[10px] text-emerald-400 font-medium">94.6% asistencia</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Retrasos</span>
                  <span className="text-xl font-bold text-yellow-500">3</span>
                  <span className="text-[10px] text-slate-400 font-medium">Dentro del límite</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col gap-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Solicitudes</span>
                  <span className="text-xl font-bold text-teal-400">2</span>
                  <span className="text-[10px] text-teal-400/95 font-medium">Pendientes de aprobar</span>
                </div>
              </div>

              {/* Attendance Flow Mockup */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 pb-2 border-b border-slate-800/60">
                  <span>Marcaciones Recientes</span>
                  <span className="text-emerald-400">Actualizado en vivo</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/40">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs">GD</div>
                      <div>
                        <p className="text-xs font-bold text-white">Gianella Dueñas</p>
                        <p className="text-[10px] text-slate-500">Módulo: Matriz Principal</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Exitoso</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">11:37 AM</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-950/40 rounded-xl border border-slate-800/40">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 font-bold text-xs">JH</div>
                      <div>
                        <p className="text-xs font-bold text-white">Juan Herrera</p>
                        <p className="text-[10px] text-slate-500">Módulo: Sucursal Norte</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Exitoso</span>
                      <p className="text-[10px] text-slate-500 mt-0.5">11:35 AM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-slate-950 border-y border-slate-800/80 py-16">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <p className="text-4xl md:text-5xl font-extrabold text-white mb-2">99.9%</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Disponibilidad del Sistema</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-extrabold text-emerald-400 mb-2">+100k</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Marcaciones Procesadas</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-extrabold text-white mb-2">10x</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Menos Errores en Nómina</p>
          </div>
          <div>
            <p className="text-4xl md:text-5xl font-extrabold text-emerald-400 mb-2">2 min</p>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Configuración Inicial</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24 lg:py-32">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            Herramientas robustas diseñadas para evitar el fraude
          </h2>
          <p className="text-base text-slate-400 leading-relaxed">
            AsistePro te brinda control absoluto y transparencia en el registro de asistencia mediante algoritmos y procesos automatizados de geolocalización.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 p-8 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-emerald-500/2">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform">
              <QrCode size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Código QR Dinámico</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Evita el fraude de compartir capturas de pantalla. El código QR en la pantalla de la sucursal cambia constantemente cada 15 segundos mediante un token dinámico.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 p-8 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-teal-500/2">
            <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center text-teal-400 mb-6 group-hover:scale-110 transition-transform">
              <MapPin size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Validación por GPS</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              El sistema comprueba que la ubicación GPS del empleado esté dentro del radio geográfico de la sucursal autorizada antes de permitir registrar el ingreso o salida.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 p-8 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-blue-500/2">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 mb-6 group-hover:scale-110 transition-transform">
              <Clock size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Horarios Flexibles</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Crea turnos, gestiona tolerancia a retrasos, define los días laborales semanales y tiempos de almuerzo/descanso para adaptarse al flujo real de tu organización.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 p-8 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-yellow-500/2">
            <div className="w-12 h-12 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-400 mb-6 group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Cálculo Laboral y Horas</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Procesa horas trabajadas automáticamente por empleado, identifica faltas, calcula retrasos consolidados y genera cierres mensuales en segundos con reportes en Excel.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 p-8 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-indigo-500/2">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
              <Users size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Reemplazos y Coberturas</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              ¿Faltó un colaborador? Registra reemplazos temporales o apoyos intersucursal permitiendo al empleado de apoyo marcar en la nueva oficina de forma temporal y auditada.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 p-8 rounded-2xl transition-all duration-300 group hover:shadow-xl hover:shadow-red-500/2">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400 mb-6 group-hover:scale-110 transition-transform">
              <Building2 size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-3">Estructura Organizacional</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Define y controla la jerarquía corporativa mediante áreas, cargos estructurados y centros de costo. Asigna supervisores para gestionar aprobaciones ágilmente.
            </p>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="bg-slate-950/60 border-t border-slate-800/60 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
              Implementa AsistePro en 3 sencillos pasos
            </h2>
            <p className="text-base text-slate-400">
              Sin equipos costosos de asistencia biométrica. Aprovecha la tecnología móvil que tus colaboradores ya tienen.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-[45px] left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-blue-500/20 z-0" />
            
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-xl font-bold text-emerald-400 shadow-xl mb-6">
                1
              </div>
              <h3 className="text-lg font-bold text-white mb-3">Crea tu Empresa</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                Regístrate, ingresa los datos de tu empresa y elije el plan que mejor se adapte a tu volumen de colaboradores.
              </p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-xl font-bold text-teal-400 shadow-xl mb-6">
                2
              </div>
              <h3 className="text-lg font-bold text-white mb-3">Configura Oficinas</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                Crea las sucursales, introduce sus coordenadas de mapas y define los horarios y días asignados a cada empleado.
              </p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-xl font-bold text-blue-400 shadow-xl mb-6">
                3
              </div>
              <h3 className="text-lg font-bold text-white mb-3">Escanea y Registra</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                Tus empleados descargan la aplicación en su celular, escanean el código QR en la sucursal y el sistema valida su ingreso al instante.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-24 lg:py-32">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4">
            Planes flexibles para el tamaño de tu empresa
          </h2>
          <p className="text-base text-slate-400">
            Prueba cualquier plan gratis por 30 días. Sin compromisos a largo plazo.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 items-stretch">
          {/* Plan 1 */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Básico</h3>
              <p className="text-sm text-slate-500 mb-6">Para pequeños equipos u oficinas locales.</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold text-white">$19.99</span>
                <span className="text-xs font-semibold text-slate-500">/ mes</span>
              </div>
              <ul className="space-y-4 text-sm text-slate-400 mb-8">
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Hasta 15 empleados</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>1 Sucursal activa</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Control de asistencia simple</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>QR dinámico + GPS estándar</span>
                </li>
              </ul>
            </div>
            <Link
              to="/register"
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-center font-bold text-slate-200 rounded-xl transition-all"
            >
              Comenzar Gratis
            </Link>
          </div>

          {/* Plan 2 */}
          <div className="bg-slate-950 border-2 border-emerald-500 rounded-3xl p-8 flex flex-col justify-between relative shadow-xl shadow-emerald-500/5">
            <div className="absolute top-0 right-1/2 translate-x-1/2 -translate-y-1/2 px-4 py-1 bg-emerald-500 text-slate-950 text-xs font-extrabold uppercase rounded-full tracking-wider">
              Recomendado
            </div>
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Profesional</h3>
              <p className="text-sm text-slate-500 mb-6">Para empresas en expansión con múltiples sucursales.</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold text-white">$39.99</span>
                <span className="text-xs font-semibold text-slate-500">/ mes</span>
              </div>
              <ul className="space-y-4 text-sm text-slate-400 mb-8">
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Hasta 50 empleados</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>5 Sucursales activas</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Gestión de reemplazos y turnos</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Cálculo laboral y reportes avanzados</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Soporte prioritario</span>
                </li>
              </ul>
            </div>
            <Link
              to="/register"
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-center font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all"
            >
              Comenzar Gratis
            </Link>
          </div>

          {/* Plan 3 */}
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Corporativo</h3>
              <p className="text-sm text-slate-500 mb-6">Para organizaciones robustas con alta operatividad.</p>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-bold text-white">$99.99</span>
                <span className="text-xs font-semibold text-slate-500">/ mes</span>
              </div>
              <ul className="space-y-4 text-sm text-slate-400 mb-8">
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Sin límite de empleados</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Sucursales ilimitadas</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Estructura organizacional completa</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Integración vía API externa</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  <span>Soporte dedicado 24/7</span>
                </li>
              </ul>
            </div>
            <Link
              to="/register"
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-center font-bold text-slate-200 rounded-xl transition-all"
            >
              Comenzar Gratis
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="relative py-24 lg:py-32 overflow-hidden bg-slate-950 border-t border-slate-800/80">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
            Optimiza el control de asistencia hoy mismo
          </h2>
          <p className="text-base md:text-lg text-slate-400 leading-relaxed mb-10 max-w-2xl mx-auto">
            Únete a cientos de empresas que ya han digitalizado su control de asistencia, reduciendo costos operativos y ganando transparencia.
          </p>
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/35 transition-all transform hover:-translate-y-0.5 group"
          >
            <span>Iniciar 30 días de prueba gratis</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="text-xs text-slate-500 mt-4">No se requiere tarjeta de crédito para iniciar.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800/40 py-12 text-center text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
            <span className="font-bold text-slate-300">AsistePro © {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <span>Términos de servicio</span>
            <span>Política de privacidad</span>
            <span>Contacto</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
