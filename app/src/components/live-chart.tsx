import { useState } from 'react';
import { type GestureResponderEvent, type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatTime } from '@/utils/format';

export type ChartPoint = { ts: number; value: number | null };

type LiveChartProps = {
  title: string;
  unit: string;
  points: ChartPoint[];
  /** Window bounds in epoch seconds. */
  from: number;
  to: number;
};

const Height = 72;
/** Room above and below the line so the stroke and the touch dot are not clipped. */
const PaddingY = 6;
/**
 * The box publishes every 5 s. A wider gap means readings were lost: the line
 * breaks there instead of drawing a straight segment over missing data.
 */
const MaxGapSeconds = 15;

/** Comma as the decimal separator, one decimal: "22,4". */
function formatValue(value: number) {
  return value.toFixed(1).replace('.', ',');
}

/**
 * One series over a fixed time window. Temperature and humidity get one chart
 * each: two units on one plot would need two y-axes, which misleads.
 */
export function LiveChart({ title, unit, points, from, to }: LiveChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [touchedTs, setTouchedTs] = useState<number | null>(null);

  // Readings outside the window must not stretch the scale of what is drawn.
  const values = points.filter(
    (p): p is { ts: number; value: number } => p.value !== null && p.ts >= from && p.ts <= to
  );

  let min = Math.min(...values.map((p) => p.value));
  let max = Math.max(...values.map((p) => p.value));
  // A flat series would divide by zero: give it half a unit on each side.
  if (max - min < 1) {
    const mid = (max + min) / 2;
    min = mid - 0.5;
    max = mid + 0.5;
  }

  const x = (ts: number) => ((ts - from) / (to - from)) * width;
  const y = (value: number) => PaddingY + ((max - value) / (max - min)) * (Height - 2 * PaddingY);

  let path = '';
  let previous: { ts: number; value: number } | null = null;
  for (const p of values) {
    const breaks = !previous || p.ts - previous.ts > MaxGapSeconds;
    path += `${breaks ? 'M' : 'L'}${x(p.ts).toFixed(1)},${y(p.value).toFixed(1)}`;
    previous = p;
  }

  // Nearest reading to the finger, so the readout always shows a real value.
  const touched =
    touchedTs === null
      ? null
      : values.reduce<(typeof values)[number] | null>(
          (best, p) => (!best || Math.abs(p.ts - touchedTs) < Math.abs(best.ts - touchedTs) ? p : best),
          null
        );

  function onTouch(event: GestureResponderEvent) {
    if (width === 0) return;
    const ratio = Math.min(Math.max(event.nativeEvent.locationX / width, 0), 1);
    setTouchedTs(from + ratio * (to - from));
  }

  const last = values.at(-1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {touched
            ? `${formatValue(touched.value)} ${unit} · ${formatTime(touched.ts * 1000)}`
            : values.length > 0
              ? `${formatValue(min)} – ${formatValue(max)} ${unit}`
              : ''}
        </ThemedText>
      </View>

      <View
        style={styles.plot}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onTouch}
        onResponderMove={onTouch}
        onResponderRelease={() => setTouchedTs(null)}
        onResponderTerminate={() => setTouchedTs(null)}>
        {width > 0 && values.length > 0 ? (
          <Svg width={width} height={Height}>
            {/* Recessive guides at the bottom and top of the value range. */}
            <Line x1={0} x2={width} y1={y(min)} y2={y(min)} stroke={theme.textSecondary} strokeOpacity={0.25} />
            <Line x1={0} x2={width} y1={y(max)} y2={y(max)} stroke={theme.textSecondary} strokeOpacity={0.25} />

            <Path d={path} stroke={theme.backgroundButton} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />

            {/* The newest reading gets a marker, like the "now" end of the curve. */}
            {last && !touched && <Circle cx={x(last.ts)} cy={y(last.value)} r={4} fill={theme.backgroundButton} />}

            {touched && (
              <>
                <Line
                  x1={x(touched.ts)}
                  x2={x(touched.ts)}
                  y1={0}
                  y2={Height}
                  stroke={theme.textSecondary}
                  strokeOpacity={0.6}
                />
                <Circle cx={x(touched.ts)} cy={y(touched.value)} r={5} fill={theme.backgroundButton} />
              </>
            )}
          </Svg>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            Pas encore de mesure sur les 10 dernières minutes
          </ThemedText>
        )}
      </View>

      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary">
          -10 min
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatTime(to * 1000)}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  plot: {
    height: Height,
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
  },
});
