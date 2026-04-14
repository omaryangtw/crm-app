import { SectionCard } from "./section-card";
import StatCard from "./stat-card";

interface PersonalStatsProps {
  stats: {
    activeCases: number;
    monthlyContacts: number;
    staleClients: number;
  };
}

export function PersonalStats({ stats }: PersonalStatsProps) {
  return (
    <SectionCard title="我的統計">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard title="我的進行中案件" value={stats.activeCases} />
        <StatCard title="我的本月通聯" value={stats.monthlyContacts} />
        <StatCard title="我的久未聯繫" value={stats.staleClients} />
      </div>
    </SectionCard>
  );
}
