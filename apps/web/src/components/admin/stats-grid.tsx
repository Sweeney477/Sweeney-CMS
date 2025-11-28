import { Card, CardContent } from "@/components/ui/card";

type Stat = {
  label: string;
  value: string | number;
  description?: string;
};

type Props = {
  stats: Stat[];
};

export function StatsGrid({ stats }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="py-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {stat.value}
            </p>
            {stat.description && (
              <p className="text-xs text-slate-500">{stat.description}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}


