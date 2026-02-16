import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type HomeFeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export function HomeFeatureCard({ icon: Icon, title, description }: HomeFeatureCardProps) {
  return (
    <Card className="bg-white/80 backdrop-blur border-slate-200/80 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
      <CardContent className="pt-8 pb-6 px-6 text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl mx-auto mb-5 flex items-center justify-center">
          <Icon className="h-8 w-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">{title}</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}
