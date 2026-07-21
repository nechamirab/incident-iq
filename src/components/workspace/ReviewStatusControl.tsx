import type { ReactNode } from 'react';
import { MenuItem, TextField } from '@mui/material';
import type { ReviewStatus } from '../../../shared/types/reasoning';
import { getReviewStatusDisplay, REVIEW_STATUS_OPTIONS } from '../../utils/statusDisplay';

interface ReviewStatusControlProps {
  value: ReviewStatus;
  onChange: (value: ReviewStatus) => void;
  disabled?: boolean;
}

/** Lets a human reviewer mark a fact or assumption's review status. */
export function ReviewStatusControl({ value, onChange, disabled }: ReviewStatusControlProps): ReactNode {
  return (
    <TextField
      select
      size="small"
      label="Review status"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as ReviewStatus)}
      sx={{ minWidth: 200 }}
    >
      {REVIEW_STATUS_OPTIONS.map((status) => (
        <MenuItem key={status} value={status}>
          {getReviewStatusDisplay(status).label}
        </MenuItem>
      ))}
    </TextField>
  );
}
