import { SwatchTile } from './SwatchTile';

export const SwatchComparisonPanel = ({ targetHex, predictedHex, targetHelper, predictedHelper }: { targetHex: string; predictedHex?: string; targetHelper?: string; predictedHelper?: string }) => (
  <div className="grid gap-3 md:grid-cols-2">
    <SwatchTile label="Target" hex={targetHex} helper={targetHelper} footer="Target swatch" />
    <SwatchTile label="Predicted" hex={predictedHex ?? targetHex} helper={predictedHelper ?? 'Pending recipe'} footer={predictedHex ? 'Predicted mix result' : 'Generate and select a recipe to populate this comparison.'} />
  </div>
);
