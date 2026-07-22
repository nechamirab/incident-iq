import type { ReactNode } from 'react';
import { Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';

interface EditableStringListProps {
  label: string;
  items: readonly string[];
  onChange: (items: string[]) => void;
}

/**
 * A simple add/edit/remove editor for a `string[]` field -- used by the
 * Postmortem tab for its five list fields (contributing factors,
 * hypotheses investigated, corrective actions, lessons learned, follow-up
 * items). No reordering, so index-as-key is fine here.
 */
export function EditableStringList({ label, items, onChange }: EditableStringListProps): ReactNode {
  function handleItemChange(index: number, value: string): void {
    const next = [...items];
    next[index] = value;
    onChange(next);
  }

  function handleRemove(index: number): void {
    onChange(items.filter((_item, itemIndex) => itemIndex !== index));
  }

  function handleAdd(): void {
    onChange([...items, '']);
  }

  return (
    <Stack spacing={1}>
      {items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          None recorded yet.
        </Typography>
      )}
      {items.map((item, index) => (
        <Stack key={index} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <TextField
            value={item}
            onChange={(event) => handleItemChange(index, event.target.value)}
            size="small"
            fullWidth
            placeholder={`${label} item`}
          />
          <IconButton
            size="small"
            aria-label={`Remove ${label} item ${index + 1}`}
            onClick={() => handleRemove(index)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={handleAdd} sx={{ alignSelf: 'flex-start' }}>
        Add {label.toLowerCase()} item
      </Button>
    </Stack>
  );
}
