import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function DashboardChart({ type, data }) {
  if (type === 'monthly') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Legend verticalAlign="bottom" height={36} iconType="circle" />
          <Bar name="Presentes" dataKey="presentes" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          <Bar name="Novedades" dataKey="novedades" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar name="Rechazadas" dataKey="rechazadas" fill="#64748b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke="#e5e7eb" strokeDasharray="3 3" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]}>
            {data.map((item, index) => (
              <Cell key={item.name || index} fill={['#4f46e5', '#10b981', '#06b6d4', '#f59e0b', '#8b5cf6'][index % 5]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={3}>
          {data.map((item, index) => (
            <Cell key={item.name || index} fill={['#4f46e5', '#10b981', '#06b6d4', '#f59e0b', '#8b5cf6'][index % 5]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend verticalAlign="bottom" height={36} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

