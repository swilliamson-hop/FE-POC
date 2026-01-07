'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  Maximize,
  DoorOpen,
  Euro,
  Home,
  Layers,
  Building2,
  Calendar,
  Accessibility,
  ChevronRight,
  ChevronLeft,
  Images,
  Zap,
  Check,
} from 'lucide-react';
import { getProperty, getTranslations, type PropertyData } from '@/lib/api/queries';

const DEFAULT_PROPERTY_ID = process.env.NEXT_PUBLIC_PROPERTY_ID || '300375578';

type Property = PropertyData['property'];

// German fallback labels for common enum values
const germanLabels: Record<string, Record<string, string>> = {
  heater: {
    LONG_DISTANCE: 'Fernwärme',
    DISTRICT_HEATING: 'Fernwärme',
    GAS: 'Gas',
    OIL: 'Öl',
    ELECTRIC: 'Strom',
    HEAT_PUMP: 'Wärmepumpe',
    SOLAR: 'Solar',
    PELLET: 'Pellet',
    WOOD: 'Holz',
    COAL: 'Kohle',
    BLOCK: 'Blockheizkraftwerk',
    GEOTHERMAL: 'Erdwärme',
    WOOD_PELLET: 'Holzpellets',
    LIQUID_GAS: 'Flüssiggas',
  },
  energyCertificateType: {
    USAGE_IDENTIFICATION: 'Verbrauchsausweis',
    DEMAND_IDENTIFICATION: 'Bedarfsausweis',
    CONSUMPTION: 'Verbrauchsausweis',
    DEMAND: 'Bedarfsausweis',
  },
};

// Helper to format energy certificate date (e.g., "MAY_2014" -> "Mai 2014")
function formatEnergyCertificateDate(dateStr: string): string {
  if (!dateStr) return '-';

  const monthMap: Record<string, string> = {
    JANUARY: 'Januar',
    FEBRUARY: 'Februar',
    MARCH: 'März',
    APRIL: 'April',
    MAY: 'Mai',
    JUNE: 'Juni',
    JULY: 'Juli',
    AUGUST: 'August',
    SEPTEMBER: 'September',
    OCTOBER: 'Oktober',
    NOVEMBER: 'November',
    DECEMBER: 'Dezember',
  };

  const parts = dateStr.split('_');
  if (parts.length === 2) {
    const month = monthMap[parts[0]] || parts[0];
    return `${month} ${parts[1]}`;
  }

  // Try parsing as ISO date
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date.toLocaleDateString('de-DE');
  }

  return dateStr;
}

// Helper to get translation with fallback - tries multiple key patterns
function t(translations: Record<string, string>, key: string, fallback?: string): string {
  // Try the exact key first
  if (translations[key]) return translations[key];

  // Try common alternative patterns
  const parts = key.split('.');
  const enumValue = parts.pop() || key;
  const baseName = parts.pop() || '';

  // Try patterns like: HeaterType.LONG_DISTANCE, heater.LONG_DISTANCE
  const patterns = [
    key,
    `${baseName}.${enumValue}`,
    `${baseName}Type.${enumValue}`,
    enumValue,
  ];

  for (const pattern of patterns) {
    if (translations[pattern]) return translations[pattern];
  }

  // Try German fallback labels
  if (baseName && germanLabels[baseName]?.[enumValue]) {
    return germanLabels[baseName][enumValue];
  }

  return fallback || enumValue;
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';
}

function formatAddress(address: Property['data']['address']): string {
  const parts = [];
  if (address.street) {
    parts.push(address.street + (address.houseNumber ? ' ' + address.houseNumber : ''));
  }
  if (address.zipCode || address.city) {
    parts.push([address.zipCode, address.city].filter(Boolean).join(' '));
  }
  if (address.country) {
    parts.push(address.country === 'DE' ? 'Deutschland' : address.country);
  }
  return parts.join(', ');
}

function getObjectTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    FLAT: 'Wohnen',
    HOUSE: 'Haus',
    COMMERCIAL: 'Gewerbe',
    GARAGE: 'Garage',
  };
  return labels[type] || type;
}

function getBuildingConditionLabel(condition: string): string {
  const labels: Record<string, string> = {
    FIRST_TIME_USE: 'Erstbezug',
    FIRST_TIME_USE_AFTER_RENOVATION: 'Erstbezug nach Sanierung',
    MINT_CONDITION: 'Neuwertig',
    REFURBISHED: 'Saniert',
    MODERNIZED: 'Modernisiert',
    FULLY_RENOVATED: 'Vollständig renoviert',
    WELL_KEPT: 'Gepflegt',
    NEED_OF_RENOVATION: 'Renovierungsbedürftig',
  };
  return labels[condition] || condition || '-';
}

function getGroundLabel(ground: string): string {
  const labels: Record<string, string> = {
    LAMINATE: 'Laminat',
    PARQUET: 'Parkett',
    TILES: 'Fliesen',
    CARPET: 'Teppich',
    WOOD: 'Holz',
    STONE: 'Stein',
    PVC: 'PVC',
    LINOLEUM: 'Linoleum',
  };
  return labels[ground] || ground || '-';
}


function ExposeContent() {
  const searchParams = useSearchParams();
  const propertyId = searchParams.get('propertyId') || DEFAULT_PROPERTY_ID;

  const [property, setProperty] = useState<Property | null>(null);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [propertyData, translationsData] = await Promise.all([
          getProperty(propertyId),
          getTranslations('de', false),
        ]);
        setProperty(propertyData);
        setTranslations(translationsData);
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Objekt konnte nicht geladen werden');
      } finally {
        setLoading(false);
      }
    }
    loadData();
    setCurrentImageIndex(0); // Reset image index when property changes
  }, [propertyId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Objekt nicht gefunden'}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 underline"
          >
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  const { data, titleImage, branding, customer } = property;
  const description = data.objectDescription?.de || '';
  const truncatedDescription = description.length > 200
    ? description.substring(0, 200) + '...'
    : description;

  // Build images array for slideshow (avoid duplicates with titleImage)
  const allImages: Array<{ url: string; title: string }> = [];
  if (titleImage?.url) {
    allImages.push({ url: titleImage.url, title: titleImage.title || 'Hauptbild' });
  }
  if (data.attachments) {
    data.attachments
      .filter(att => att.type === 'IMAGE' || att.url?.match(/\.(jpg|jpeg|png|gif|webp)$/i))
      .filter(att => att.url !== titleImage?.url) // Exclude titleImage to avoid duplicates
      .forEach(att => {
        allImages.push({ url: att.url, title: att.title || 'Bild' });
      });
  }

  const imageCount = allImages.length;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % imageCount);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + imageCount) % imageCount);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || imageCount <= 1) return;

    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    const minSwipeDistance = 50;

    if (diff > minSwipeDistance) {
      nextImage(); // Swipe left -> next
    } else if (diff < -minSwipeDistance) {
      prevImage(); // Swipe right -> previous
    }

    touchStartX.current = null;
  };

  // Build amenities list
  const amenities: string[] = [];
  if (data.elevator) amenities.push('Aufzug');
  if (data.barrierFree) amenities.push('Barrierefrei');
  if (data.garden || data.gardenUse) amenities.push('Garten');
  if (data.numberOfBalconies > 0) amenities.push('Balkon');
  if (data.numberOfTerraces > 0) amenities.push('Terrasse');
  if (data.kitchenette) amenities.push('Einbauküche');
  if (data.storeRoom) amenities.push('Abstellraum');
  if (data.washDryRoom) amenities.push('Wasch-/Trockenraum');
  if (data.bicycleRoom) amenities.push('Fahrradraum');
  if (data.attic) amenities.push('Dachboden');
  if (data.basementAvailable) amenities.push('Keller');
  if (data.fireplace) amenities.push('Kamin');
  if (data.guestToilette) amenities.push('Gäste-WC');
  if (data.wheelchairAccessible) amenities.push('Rollstuhlgerecht');

  return (
    <div className="min-h-screen bg-page pb-28">
      {/* Image Slideshow */}
      <div
        className="relative h-72 md:h-96 bg-gray-300 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {allImages.length > 0 ? (
          <div
            className="flex h-full transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
          >
            {allImages.map((img, idx) => (
              <div key={idx} className="relative w-full h-full shrink-0">
                <Image
                  src={img.url}
                  alt={img.title}
                  fill
                  className="object-cover"
                  priority={idx === 0}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Building2 className="w-24 h-24 text-gray-400" />
          </div>
        )}

        {/* Image Counter */}
        {imageCount > 0 && (
          <div className="absolute bottom-4 left-4 bg-white rounded-full px-3 py-1.5 flex items-center gap-2 shadow-md">
            <Images className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">{imageCount} Fotos</span>
          </div>
        )}

        {/* Navigation Arrows */}
        {imageCount > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>
            <button
              onClick={nextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
            >
              <ChevronRight className="w-6 h-6 text-gray-700" />
            </button>
          </>
        )}

        {/* Dots Indicator */}
        {imageCount > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {allImages.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  idx === currentImageIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-2 sm:px-4 -mt-4 relative z-10">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-gray-100">
            {/* Type Badge */}
            <span className="inline-block px-3 py-1 bg-gray-800 text-white text-xs font-medium rounded mb-3">
              {getObjectTypeLabel(property.type)}
            </span>

            {/* Title */}
            <h1 className="text-xl font-bold text-gray-900 mb-1">
              {data.name || 'Objekt'}
            </h1>

            {/* Address */}
            {data.showAddress && data.address && (
              <p className="text-sm text-gray-600 mb-4">
                {formatAddress(data.address)}
              </p>
            )}

            {/* Quick Facts */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-4 sm:gap-6 text-sm text-gray-600">
                <span className="flex items-center gap-1.5">
                  <Maximize className="w-4 h-4" />
                  {data.size || property.size} m²
                </span>
                <span className="flex items-center gap-1.5">
                  <DoorOpen className="w-4 h-4" />
                  {data.rooms} Zimmer
                </span>
              </div>
              <div className="sm:text-right">
                <span className="text-lg font-bold text-gray-900">
                  {formatCurrency(data.totalRentGross || property.totalRentGross)}
                </span>
                <span className="text-sm text-gray-500"> mtl.</span>
              </div>
            </div>
          </div>

          {/* Provider Info */}
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Angebot von:</p>
              <p className="text-sm font-medium text-gray-900">{customer?.name || data.customerName}</p>
            </div>
            {(customer?.logo || data.customerLogo) && (
              <Image
                src={customer?.logo || data.customerLogo}
                alt={customer?.name || 'Logo'}
                width={80}
                height={40}
                className="object-contain"
              />
            )}
          </div>

          {/* Description */}
          {description && (
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Beschreibung</h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                {showFullDescription ? description : truncatedDescription}
              </p>
              {description.length > 200 && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-sm text-blue-600 font-medium mt-2 hover:underline"
                >
                  {showFullDescription ? 'Weniger anzeigen' : 'Mehr anzeigen'}
                </button>
              )}
            </div>
          )}

          {/* Costs & Details */}
          <div className="px-4 sm:px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 border-b border-gray-100">
            {/* Costs */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-4">Kosten</h2>
              <div className="space-y-3">
                <CostRow icon={<Euro className="w-4 h-4" />} label="Grundmiete" value={formatCurrency(data.basePrice)} />
                <CostRow icon={<Euro className="w-4 h-4" />} label="Betriebskosten" value={formatCurrency(data.serviceCharge)} />
                <CostRow icon={<Euro className="w-4 h-4" />} label="Sonstige Kosten" value={formatCurrency(data.otherCosts)} />
                <CostRow icon={<Euro className="w-4 h-4" />} label="Kaution/Genossenschaftsanteile" value={formatCurrency(data.bailment)} />
                <CostRow icon={<Euro className="w-4 h-4" />} label="Heizkosten" value={formatCurrency(data.heatingCost)} />
                <div className="pt-2 border-t border-gray-200">
                  <CostRow
                    icon={<Euro className="w-4 h-4" />}
                    label="Gesamtmiete (in €)"
                    value={formatCurrency(data.totalRentGross || property.totalRentGross)}
                    bold
                  />
                </div>
              </div>
            </div>

            {/* Details */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-4">Details</h2>
              <div className="space-y-3">
                <DetailRow icon={<Home className="w-4 h-4" />} label="Objekttyp" value={getObjectTypeLabel(property.type)} />
                <DetailRow icon={<Building2 className="w-4 h-4" />} label="Objektzustand" value={getBuildingConditionLabel(data.buildingCondition)} />
                <DetailRow icon={<Layers className="w-4 h-4" />} label="Etage" value={data.floor?.toString() || '-'} />
                <DetailRow icon={<Layers className="w-4 h-4" />} label="Fußboden" value={getGroundLabel(data.ground)} />
                <DetailRow icon={<Accessibility className="w-4 h-4" />} label="Barrierefrei" value={data.barrierFree ? 'Ja' : 'Nein'} />
                <DetailRow icon={<Calendar className="w-4 h-4" />} label="Baujahr" value={data.constructionYear?.toString() || '-'} />
                {data.basementSize > 0 && (
                  <DetailRow icon={<Home className="w-4 h-4" />} label="Kellerfläche" value={`${data.basementSize} m²`} />
                )}
              </div>
            </div>
          </div>

          {/* Amenities / Ausstattung */}
          {amenities.length > 0 && (
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Ausstattung</h2>
              <div className="flex flex-wrap gap-2">
                {amenities.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Energy Efficiency / Energieeffizienz */}
          {(data.heater || data.energyCertificate) && (
            <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Energieeffizienz</h2>
              <div className="space-y-3">
                {data.energyCertificate?.creationDate && (
                  <DetailRow icon={<Calendar className="w-4 h-4" />} label="Erstellungsdatum Energieausweis" value={formatEnergyCertificateDate(data.energyCertificate.creationDate)} />
                )}
                {data.energyCertificate?.energyCertificateType && (
                  <DetailRow icon={<Zap className="w-4 h-4" />} label="Energieausweistyp" value={t(translations, `general.energyCertificateType.${data.energyCertificate.energyCertificateType}`, data.energyCertificate.energyCertificateType)} />
                )}
                {/* Show energy efficiency class from either usage or demand certificate */}
                {(data.energyCertificate?.usageCertificate?.energyEfficiencyClass || data.energyCertificate?.demandCertificate?.energyEfficiencyClass) && (
                  <DetailRow icon={<Zap className="w-4 h-4" />} label="Energieeffizienzklasse" value={data.energyCertificate.usageCertificate?.energyEfficiencyClass || data.energyCertificate.demandCertificate?.energyEfficiencyClass || '-'} />
                )}
                {data.energyCertificate?.primaryEnergyProvider && (
                  <DetailRow icon={<Zap className="w-4 h-4" />} label="Wesentlicher Energieträger" value={t(translations, `general.heater.${data.energyCertificate.primaryEnergyProvider}`, data.energyCertificate.primaryEnergyProvider)} />
                )}
                {data.heater && (
                  <DetailRow icon={<Zap className="w-4 h-4" />} label="Heizungsart" value={t(translations, `general.heater.${data.heater}`, data.heater)} />
                )}
                {/* Endenergiebedarf/-verbrauch */}
                {data.energyCertificate?.demandCertificate?.endEnergyConsumption && (
                  <DetailRow icon={<Zap className="w-4 h-4" />} label="Endenergiebedarf" value={`${data.energyCertificate.demandCertificate.endEnergyConsumption} kWh/(m²a)`} />
                )}
                {data.energyCertificate?.usageCertificate?.energyConsumption && (
                  <DetailRow icon={<Zap className="w-4 h-4" />} label="Endenergieverbrauch" value={`${data.energyCertificate.usageCertificate.energyConsumption} kWh/(m²a)`} />
                )}
                {/* Primärenergiebedarf */}
                {data.energyCertificate?.primaryEnergyConsumption && (
                  <DetailRow icon={<Zap className="w-4 h-4" />} label="Primärenergiebedarf" value={`${data.energyCertificate.primaryEnergyConsumption} kWh/(m²a)`} />
                )}
                {data.heatingCostIncluded !== undefined && (
                  <DetailRow icon={<Euro className="w-4 h-4" />} label="Heizkosten inkl." value={data.heatingCostIncluded ? 'Ja' : 'Nein'} />
                )}
              </div>
            </div>
          )}

          {/* Info Boxes */}
          <div className="px-4 sm:px-6 py-4 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                Informationen zum Bewerbungsprozess:
              </h3>
              <p className="text-xs text-blue-800 leading-relaxed">
                Die persönlichen Daten werden in einem passwortgeschützten Bereich verschlüsselt
                gespeichert und stufenweise dem Vermieter angezeigt. Das Einsichtsrecht kann dem
                Vermieter jederzeit entzogen werden.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                SCHUFA-Hinweis und Information
              </h3>
              <p className="text-xs text-blue-800 leading-relaxed">
                Vor dem Abschluss eines Mietvertrags kann der Vermieter eine Bonitätsauskunft
                einholen. Weitere Informationen hierzu können dem{' '}
                <a href="https://tenant.sandbox.immomio.com/static/schufa-info" target="_blank" rel="noopener noreferrer" className="underline">SCHUFA-Hinweis</a> entnommen werden.
              </p>
            </div>
          </div>

          {/* Footer Links */}
          <div className="px-4 sm:px-6 py-4 border-t border-gray-100">
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <a href="https://www.mieter.immomio.com/agb" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">AGB</a>
              <a href="https://www.mieter.immomio.com/datenschutz" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">Datenschutz</a>
              <a href="https://www.mieter.immomio.com/impressum" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">Impressum</a>
              <a href="https://immomio-asset-store.s3.eu-central-1.amazonaws.com/250626_Interessentenportal_Barrierefreiheitserkla%CC%88rung.pdf" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700">Barrierefreiheitserklärung</a>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Apply Button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-50 safe-area-bottom">
        <div className="max-w-2xl mx-auto">
          <Link href={`/bewerbung?propertyId=${property.id}`}>
            <button
              className="w-full py-4 rounded-xl font-semibold text-white transition-colors"
              style={{
                backgroundColor: '#3486ef',
              }}
            >
              Jetzt bewerben
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function CostRow({
  icon,
  label,
  value,
  bold = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="flex items-start gap-2 text-gray-600 min-w-0">
        <span className="shrink-0 mt-0.5">{icon}</span>
        <span className="break-words">{label}</span>
      </span>
      <span className={`shrink-0 text-right ${bold ? 'font-semibold text-gray-900' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-sm">
      <span className="flex items-start gap-2 text-gray-600 min-w-0">
        <span className="shrink-0 mt-0.5">{icon}</span>
        <span className="break-words">{label}</span>
      </span>
      <span className="text-gray-900 shrink-0 text-right">{value}</span>
    </div>
  );
}

export default function ExposePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-page flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      }
    >
      <ExposeContent />
    </Suspense>
  );
}
