import { SwatchTile } from './SwatchTile';

export const SwatchComparisonPanel = ({ targetHex, predictedHex, targetHelper, predictedHelper }: { targetHex: string; predictedHex?: string; targetHelper?: string; predictedHelper?: string }) => (
  <div className="swatch-comparison-grid">
    <div className="swatch-comparison-frame">
      <SwatchTile label="Target" hex={targetHex} helper={targetHelper} footer="Target swatch" />
    </div>
    <div className="swatch-comparison-frame">
      <SwatchTile label="Predicted" hex={predictedHex ?? targetHex} helper={predictedHelper ?? 'Pending recipe'} footer={predictedHex ? 'Predicted mix result' : 'Generate and select a recipe to populate this comparison.'} />
    </div>
  </div>
);
