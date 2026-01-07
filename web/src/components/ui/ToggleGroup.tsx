'use client';

interface ToggleGroupProps {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}

export function ToggleGroup({ label, value, onChange }: ToggleGroupProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`
            px-8 py-3 rounded-xl border-2 font-medium transition-all
            ${
              value === true
                ? 'border-blue-700 bg-blue-700 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }
          `}
        >
          Ja
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`
            px-8 py-3 rounded-xl border-2 font-medium transition-all
            ${
              value === false
                ? 'border-blue-700 bg-blue-700 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }
          `}
        >
          Nein
        </button>
      </div>
    </div>
  );
}
