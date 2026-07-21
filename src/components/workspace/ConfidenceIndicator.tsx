import type { ReactNode } from 'react';
import { Box, LinearProgress, Stack, Typography } from '@mui/material';
import { getConfidenceDescriptor } from '../../utils/confidenceDescriptor';

interface ConfidenceIndicatorProps {
  confidence: number;
}

/**
 * Renders a confidence score as a progress bar plus a text label and text
 * descriptor ("Moderate confidence") -- confidence is never communicated
 * by the bar's color or length alone, per the app's accessibility rules.
 */
export function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps): ReactNode {
  return (
    <Stack spacing={0.5} sx={{ minWidth: 160 }}>
      <Typography variant="body2">
        Confidence: {confidence}/100 &middot; {getConfidenceDescriptor(confidence)}
      </Typography>
      <Box role="img" aria-label={`Confidence ${confidence} out of 100, ${getConfidenceDescriptor(confidence).toLowerCase()}`}>
        <LinearProgress variant="determinate" value={confidence} />
      </Box>
    </Stack>
  );
}
