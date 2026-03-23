import { SwatchTile } from './SwatchTile';

export const SwatchComparisonPanel = ({
  targetHex,
  predictedHex,
  targetHelper,
  predictedHelper,
}: {
  targetHex: string;
  predictedHex?: string;
  targetHelper?: string;
  predictedHelper?: string;
}) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <SwatchTile
      label="Target"
      hex={targetHex}
      helper={targetHelper}
      footer="Target"
    />
    <SwatchTile
      label="Predicted"
      hex={predictedHex ?? targetHex}
      helper={predictedHelper ?? 'Pending'}
      footer={predictedHex ? 'Recipe result' : 'No recipe selected yet'}
    />
  </div>
);