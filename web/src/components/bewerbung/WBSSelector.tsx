'use client';

import { useState } from 'react';
import { ChevronDown, ChevronLeft, ArrowLeft } from 'lucide-react';
import { BUNDESLAENDER, getWBSOptionsForBundesland } from '@/lib/constants/bundeslaender-wbs';

interface WBSSelectorProps {
  selectedBundesland: string | null;
  selectedWBS: string | null;
  onBundeslandChange: (bundesland: string | null) => void;
  onWBSChange: (wbs: string | null) => void;
}

type ViewState = 'closed' | 'bundesland' | 'wbs';

export function WBSSelector({
  selectedBundesland,
  selectedWBS,
  onBundeslandChange,
  onWBSChange,
}: WBSSelectorProps) {
  const [viewState, setViewState] = useState<ViewState>('closed');

  const wbsOptions = selectedBundesland
    ? getWBSOptionsForBundesland(selectedBundesland)
    : [];

  const selectedWBSLabel = wbsOptions.find((opt) => opt.value === selectedWBS)?.label;

  const getDisplayText = () => {
    if (selectedWBS && selectedWBSLabel) {
      return selectedWBSLabel;
    }
    return 'Wohnberechtigungsschein wählen';
  };

  const handleBundeslandSelect = (bundesland: string) => {
    onBundeslandChange(bundesland);
    onWBSChange(null);
    setViewState('wbs');
  };

  const handleWBSSelect = (wbs: string) => {
    onWBSChange(wbs);
    setViewState('closed');
  };

  const handleBackToBundesland = () => {
    setViewState('bundesland');
  };

  const handleClear = () => {
    onBundeslandChange(null);
    onWBSChange(null);
    setViewState('closed');
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Wohnberechtigungsschein
      </label>
      <p className="text-sm text-gray-600 mb-3">
        Falls Sie im Besitz eines Wohnberechtigungsscheins sind, wählen Sie bitte im
        Folgenden das entsprechende Bundesland und anschließend den konkreten Schein aus.
      </p>

      <div className="relative">
        <button
          type="button"
          onClick={() => setViewState(viewState === 'closed' ? 'bundesland' : 'closed')}
          className={`
            w-full px-4 py-4 text-left border-2 rounded-xl transition-all duration-200 bg-white
            flex items-center justify-between
            ${viewState !== 'closed' ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'}
          `}
        >
          <span className={selectedWBS ? 'text-gray-900' : 'text-gray-500'}>
            {getDisplayText()}
          </span>
          <ChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${
              viewState !== 'closed' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {viewState === 'bundesland' && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-auto">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Wählen Sie Ihr Bundesland</h3>
            </div>
            {BUNDESLAENDER.map((bundesland) => (
              <button
                key={bundesland}
                type="button"
                onClick={() => handleBundeslandSelect(bundesland)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center justify-between text-gray-900"
              >
                {bundesland}
                <ChevronLeft className="w-4 h-4 text-gray-400 rotate-180" />
              </button>
            ))}
          </div>
        )}

        {viewState === 'wbs' && selectedBundesland && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-80 overflow-auto">
            <button
              type="button"
              onClick={handleBackToBundesland}
              className="sticky top-0 w-full bg-white px-4 py-3 border-b border-gray-200 flex items-center gap-2 text-blue-600 font-medium hover:bg-gray-50"
            >
              <ArrowLeft className="w-4 h-4" />
              Zurück
            </button>
            {wbsOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleWBSSelect(option.value)}
                className={`
                  w-full px-4 py-3 text-left hover:bg-gray-50 text-gray-900
                  ${option.value === selectedWBS ? 'bg-blue-50 text-blue-600' : ''}
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedWBS && (
        <button
          type="button"
          onClick={handleClear}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Auswahl zurücksetzen
        </button>
      )}
    </div>
  );
}
