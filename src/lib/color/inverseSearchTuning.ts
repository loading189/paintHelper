import { getDeveloperCalibration } from './developerCalibration';

/**
 * Compatibility accessor for inverse tuning. The centralized calibration store
 * now lives in developerCalibration.ts so inverse and forward controls stay in
 * one developer-only place.
 */
export const getInverseSearchTuning = () => getDeveloperCalibration().inverseSearch;

export type InverseSearchTuning = ReturnType<typeof getInverseSearchTuning>;
