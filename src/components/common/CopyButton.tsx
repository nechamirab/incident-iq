import { useState, type ReactNode } from 'react';
import { IconButton, Snackbar, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

interface CopyButtonProps {
  value: string;
  label: string;
}

/** An icon button that copies `value` to the clipboard, with brief feedback. */
export function CopyButton({ value, label }: CopyButtonProps): ReactNode {
  const [justCopied, setJustCopied] = useState(false);

  async function handleCopy(): Promise<void> {
    await navigator.clipboard.writeText(value);
    setJustCopied(true);
  }

  return (
    <>
      <Tooltip title={`Copy ${label}`}>
        <IconButton size="small" aria-label={`Copy ${label}`} onClick={() => void handleCopy()}>
          <ContentCopyIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Snackbar
        open={justCopied}
        autoHideDuration={2000}
        onClose={() => setJustCopied(false)}
        message={`${label} copied to clipboard`}
      />
    </>
  );
}
