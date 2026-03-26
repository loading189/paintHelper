import { SwatchTile } from './SwatchTile';
import styles from './SwatchComparisonPanel.module.css';

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
  <div className={styles.panel}>
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
