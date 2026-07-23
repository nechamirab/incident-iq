import { useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import DescriptionIcon from '@mui/icons-material/Description';
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_FILES_PER_INCIDENT,
  MAX_FILE_SIZE_BYTES,
} from '../../../shared/constants/fileUpload';
import { formatFileSize } from '../../utils/formatFileSize';
import { resolveFileSelection } from '../../utils/fileValidation';

const PREVIEW_BYTE_LIMIT = 2000;

interface FileUploadZoneProps {
  files: File[];
  onChange: (files: File[]) => void;
}

/**
 * Drag-and-drop (and click-to-browse) evidence file upload area. Validates
 * each selected file client-side (extension and size) before adding it,
 * and lets the user preview the first portion of a file's text content or
 * remove it before submitting the form. Authoritative validation always
 * still happens on the backend.
 */
export function FileUploadZone({ files, onChange }: FileUploadZoneProps): ReactNode {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [rejectionErrors, setRejectionErrors] = useState<string[]>([]);
  const [expandedFileName, setExpandedFileName] = useState<string | null>(null);
  const [previewsByName, setPreviewsByName] = useState<Record<string, string>>({});

  /**
   * Validates one newly selected/dropped batch via the shared
   * {@link resolveFileSelection} logic and replaces the rejection-error
   * state wholesale with this batch's result (never merged with a
   * previous call's errors) -- this is what guarantees a stale message
   * about an earlier, now-irrelevant selection attempt never survives a
   * new one, whether it arrived via the file picker or a drop.
   */
  function addFiles(candidates: File[]): void {
    const { accepted, errors } = resolveFileSelection(files.length, candidates);

    setRejectionErrors(errors);
    if (accepted.length > 0) {
      onChange([...files, ...accepted]);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files) {
      addFiles(Array.from(event.target.files));
    }
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDraggingOver(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  /**
   * Removing a file is a fresh user action that supersedes any rejection
   * message from a previous selection attempt -- rejection errors are
   * never tied to a specific item still in `files` (an invalid file is
   * never added to the list in the first place), so any removal clears
   * them, rather than leaving a stale message with nothing left to
   * associate it with.
   */
  function handleRemove(target: File): void {
    onChange(files.filter((file) => file !== target));
    setRejectionErrors([]);
    setPreviewsByName((current) => {
      const next = { ...current };
      delete next[target.name];
      return next;
    });
  }

  async function togglePreview(file: File): Promise<void> {
    if (expandedFileName === file.name) {
      setExpandedFileName(null);
      return;
    }

    setExpandedFileName(file.name);
    if (!previewsByName[file.name]) {
      const text = await file.slice(0, PREVIEW_BYTE_LIMIT).text();
      setPreviewsByName((current) => ({ ...current, [file.name]: text }));
    }
  }

  return (
    <Stack spacing={1.5}>
      <Paper
        variant="outlined"
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        sx={{
          p: 3,
          textAlign: 'center',
          borderStyle: 'dashed',
          borderColor: isDraggingOver ? 'primary.main' : 'divider',
          bgcolor: isDraggingOver ? 'action.hover' : 'transparent',
        }}
      >
        <Stack spacing={1} sx={{ alignItems: 'center' }}>
          <UploadFileIcon color="action" aria-hidden="true" />
          <Typography variant="body2" color="text.secondary">
            Drag and drop files here, or
          </Typography>
          <Button component="label" variant="outlined" size="small">
            Browse files
            <input
              type="file"
              hidden
              multiple
              accept={ALLOWED_FILE_EXTENSIONS.join(',')}
              onChange={handleInputChange}
            />
          </Button>
          <Typography variant="caption" color="text.secondary">
            Supported formats: {ALLOWED_FILE_EXTENSIONS.join(', ')} &middot; Max{' '}
            {formatFileSize(MAX_FILE_SIZE_BYTES)} per file &middot; Up to {MAX_FILES_PER_INCIDENT}{' '}
            files
          </Typography>
        </Stack>
      </Paper>

      {rejectionErrors.length > 0 && (
        <Alert severity="warning" variant="outlined" onClose={() => setRejectionErrors([])}>
          <Stack spacing={0.5}>
            {rejectionErrors.map((error) => (
              <Typography key={error} variant="body2">
                {error}
              </Typography>
            ))}
          </Stack>
        </Alert>
      )}

      {files.length > 0 && (
        <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {files.map((file) => (
            <Paper key={file.name} variant="outlined" component="li" sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <DescriptionIcon color="action" fontSize="small" aria-hidden="true" />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap title={file.name}>
                    {file.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(file.size)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  aria-label={`Preview ${file.name}`}
                  onClick={() => void togglePreview(file)}
                >
                  {expandedFileName === file.name ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => handleRemove(file)}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Collapse in={expandedFileName === file.name}>
                <Box
                  component="pre"
                  sx={{
                    mt: 1.5,
                    p: 1.5,
                    bgcolor: 'grey.50',
                    borderRadius: 1,
                    fontSize: 12,
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {previewsByName[file.name] ?? 'Loading preview…'}
                </Box>
              </Collapse>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
