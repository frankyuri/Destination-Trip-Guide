import React from 'react';
import { Car, Train, Bus, Ship, Footprints, Plane } from 'lucide-react';
import { TransportType } from '../types';

interface TransportIconProps {
    type: TransportType;
    size?: number;
    className?: string;
}

export const TransportIcon: React.FC<TransportIconProps> = ({
    type,
    size = 16,
    className = ''
}) => {
    const iconProps = { size, className };

    switch (type) {
        case TransportType.TAXI:
            return <Car {...iconProps} />;
        case TransportType.TRAIN:
            return <Train {...iconProps} />;
        case TransportType.BUS:
            return <Bus {...iconProps} />;
        case TransportType.SHIP:
            return <Ship {...iconProps} />;
        case TransportType.WALK:
            return <Footprints {...iconProps} />;
        case TransportType.FLIGHT:
            return <Plane {...iconProps} />;
        default:
            return <Car {...iconProps} />;
    }
};

import { TranslationKeys } from '../i18n/locales/zh-TW';

/** Transport type → i18n key mapping */
const TRANSPORT_I18N_MAP: Record<TransportType, TranslationKeys> = {
    [TransportType.TAXI]: 'transportTaxi',
    [TransportType.TRAIN]: 'transportTrain',
    [TransportType.BUS]: 'transportBus',
    [TransportType.SHIP]: 'transportShip',
    [TransportType.WALK]: 'transportWalk',
    [TransportType.FLIGHT]: 'transportFlight',
};

/**
 * Get localized transport label.
 * Accepts an optional `t` function from useI18n() for proper translations.
 * Falls back to looking up the key in the map when `t` is not provided.
 */
export const getTransportLabel = (
    type: TransportType,
    t?: (key: TranslationKeys) => string
): string => {
    const key = TRANSPORT_I18N_MAP[type] ?? 'transportWalk';
    if (t) return t(key);
    // Fallback — return the key itself (components that need i18n should pass t)
    const fallback: Record<string, string> = {
        transportTaxi: '計程車',
        transportTrain: '電車/JR',
        transportBus: '公車',
        transportShip: '船',
        transportWalk: '步行',
        transportFlight: '飛機',
    };
    return fallback[key] ?? type;
};
