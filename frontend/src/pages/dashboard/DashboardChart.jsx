import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
          <Bar dataKey="presentes" fill="#4f46e5" radius={[4, 4, 0, 0]} />
          <Bar dataKey="novedades" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="rechazadas" fill="#64748b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={54} outerRadius={86} paddingAngle={3}>
          {data.map((item, index) => (
            <Cell key={item.name || index} fill={['#4f46e5', '#10b981', '#06b6d4', '#f59e0b'][index % 4]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
