type HomeStepProps = {
  number: number;
  title: string;
  description: string;
};

export function HomeStep({ number, title, description }: HomeStepProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-md shadow-blue-500/30">
        {number}
      </div>
      <div>
        <h4 className="font-medium text-slate-900 mb-1">{title}</h4>
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
