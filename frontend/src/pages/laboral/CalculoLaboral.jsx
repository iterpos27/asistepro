import { useEffect, useState } from 'react';
import { AlarmClock, CalendarX, Clock3, Download, Lock, TimerReset, Unlock } from 'lucide-react';
import MetricCard from '../../components/cards/MetricCard';
import PageHeader from '../../components/common/PageHeader';
import PanelTitle from '../../components/common/PanelTitle';
import { useAuthContext } from '../../context/AuthContext';
import * as service from '../../services/laboralService';
import { toast } from '../../services/toastService';

const currentMonth=new Date().toISOString().slice(0,7);
function hours(minutes){return `${(Number(minutes||0)/60).toFixed(2)} h`;}

export default function CalculoLaboral(){
  const {user}=useAuthContext();const [month,setMonth]=useState(currentMonth);const [data,setData]=useState({resumen:{},items:[],cierre:null});const [closures,setClosures]=useState([]);const [loading,setLoading]=useState(false);
  const canClose=user?.permisos?.cierres_mensuales?.cerrar===true;const canReopen=user?.permisos?.cierres_mensuales?.reabrir===true;const closed=data.cierre?.estado==='cerrado';const periodFinished=month<currentMonth;
  async function load(){setLoading(true);try{const [calculation,list]=await Promise.all([service.getCalculo(month),service.listCierres()]);setData(calculation);setClosures(list||[]);}finally{setLoading(false);}}
  useEffect(()=>{load();},[month]);
  async function closeMonth(){if(!window.confirm(`Cerrar ${month}? Las marcaciones y correcciones quedaran bloqueadas.`))return;await service.cerrarMes(month);toast.success('Mes cerrado correctamente');await load();}
  async function reopenMonth(){const reason=window.prompt('Motivo obligatorio para reabrir el mes');if(!reason)return;await service.reabrirMes(month,reason);toast.success('Mes reabierto');await load();}
  return <>
    <PageHeader title="Calculo laboral" description="Horas ordinarias, extras, atrasos, ausencias y cierre mensual." actions={<><input aria-label="Mes de calculo" type="month" value={month} onChange={e=>setMonth(e.target.value)}/><button className="outline-button" onClick={()=>service.exportarCalculo(month)}><Download size={16}/>Exportar</button>{closed&&canReopen?<button className="outline-button" onClick={reopenMonth}><Unlock size={16}/>Reabrir</button>:canClose&&periodFinished?<button className="primary-button compact" onClick={closeMonth}><Lock size={16}/>Cerrar mes</button>:null}</>}/>
    {closed&&<div className="alert-success">Periodo cerrado. El resultado esta congelado desde {new Date(data.cierre.cerrado_en).toLocaleString()}.</div>}
    <section className="metrics-grid"><MetricCard label="Horas trabajadas" value={hours(data.resumen.minutos_trabajados)} icon={Clock3}/><MetricCard label="Horas extra" value={hours(data.resumen.minutos_extra)} icon={TimerReset} tone="success"/><MetricCard label="Atrasos" value={hours(data.resumen.minutos_atraso)} icon={AlarmClock} tone="warning"/><MetricCard label="Ausencias" value={data.resumen.ausencias||0} icon={CalendarX} tone="accent"/></section>
    <div className="panel"><PanelTitle title="Detalle diario" subtitle={loading?'Calculando...':`${data.items?.length||0} jornadas`}/><div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Empleado</th><th>Horario</th><th>Entrada</th><th>Salida</th><th>Programadas</th><th>Trabajadas</th><th>Extra</th><th>Atraso</th><th>Estado</th></tr></thead><tbody>{data.items?.length?data.items.map((item,index)=><tr key={`${item.empleado_id}-${item.fecha}-${index}`}><td>{item.fecha}</td><td>{item.empleado_codigo} - {item.empleado_nombre}</td><td>{item.horario||'-'}</td><td>{item.entrada?.slice(0,5)||'-'}</td><td>{item.salida?.slice(0,5)||'-'}</td><td>{hours(item.minutos_programados)}</td><td>{hours(item.minutos_trabajados)}</td><td>{hours(item.minutos_extra)}</td><td>{item.minutos_atraso} min</td><td><span className={`status-pill ${item.estado==='ausente'?'danger':item.estado==='incompleta'?'warning':''}`}>{item.estado}</span></td></tr>):<tr><td colSpan="10">No hay jornadas calculables para este mes.</td></tr>}</tbody></table></div></div>
    <div className="panel"><PanelTitle title="Historial de cierres"/><div className="table-wrap"><table><thead><tr><th>Mes</th><th>Estado</th><th>Cerrado por</th><th>Fecha cierre</th><th>Reapertura</th></tr></thead><tbody>{closures.length?closures.map(item=><tr key={item.id}><td>{item.mes}</td><td><span className="status-pill">{item.estado}</span></td><td>{item.cerrado_por_nombre} {item.cerrado_por_apellido}</td><td>{new Date(item.cerrado_en).toLocaleString()}</td><td>{item.motivo_reapertura||'-'}</td></tr>):<tr><td colSpan="5">No hay cierres registrados.</td></tr>}</tbody></table></div></div>
  </>;
}
