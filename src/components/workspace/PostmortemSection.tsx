import { useState, type ReactNode } from 'react';
import { Alert, Button, Card, CardContent, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import type { Incident } from '../../../shared/types/incident';
import type { Postmortem } from '../../../shared/types/postmortem';
import { CopyButton } from '../common/CopyButton';
import { EditableStringList } from './EditableStringList';
import { useEditPostmortem } from '../../hooks/useEditPostmortem';
import { useGeneratePostmortem } from '../../hooks/useGeneratePostmortem';
import type { PostmortemContent } from '../../services/postmortemService';
import { buildPostmortemMarkdown } from '../../utils/buildPostmortemMarkdown';
import { getLatestAnalysisRun } from '../../utils/getLatestAnalysisRun';

interface PostmortemSectionProps {
  incident: Incident;
}

/** Strips a postmortem's system-managed provenance fields down to its editable content. */
function toContent(postmortem: Postmortem): PostmortemContent {
  const {
    provider: _provider,
    model: _model,
    promptVersion: _promptVersion,
    generatedAt: _generatedAt,
    lastEditedAt: _lastEditedAt,
    ...content
  } = postmortem;
  return content;
}

/** Triggers a browser download of `content` as a `.md` file named `filename`. */
function downloadMarkdown(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

const CONTENT_FIELDS: ReadonlyArray<{
  key: keyof PostmortemContent;
  label: string;
  multiline?: boolean;
}> = [
  { key: 'incidentSummary', label: 'Incident summary', multiline: true },
  { key: 'impact', label: 'Impact', multiline: true },
  { key: 'detection', label: 'Detection', multiline: true },
  { key: 'timeline', label: 'Timeline', multiline: true },
  { key: 'likelyCause', label: 'Likely cause', multiline: true },
  { key: 'uncertaintyStatement', label: 'Uncertainty', multiline: true },
  { key: 'resolution', label: 'Resolution', multiline: true },
];

const LIST_FIELDS: ReadonlyArray<{ key: keyof PostmortemContent; label: string }> = [
  { key: 'contributingFactors', label: 'Contributing factors' },
  { key: 'hypothesesInvestigated', label: 'Hypotheses investigated' },
  { key: 'correctiveActions', label: 'Corrective actions' },
  { key: 'lessonsLearned', label: 'Lessons learned' },
  { key: 'followUpItems', label: 'Follow-up items' },
];

/**
 * The Postmortem tab: an AI-drafted postmortem document every field of
 * which stays human-editable in place (unlike the skeptic review's
 * AI-authored content plus a bolt-on notes field) -- see `PostmortemSchema`'s
 * doc comment for why. Supports generating/regenerating a draft, saving
 * edits, and exporting the current content as a standalone Markdown
 * document (copy to clipboard or download).
 */
export function PostmortemSection({ incident }: PostmortemSectionProps): ReactNode {
  const latestRun = getLatestAnalysisRun(incident);
  const generateMutation = useGeneratePostmortem(incident.id);
  const editMutation = useEditPostmortem(incident.id);

  const [draft, setDraft] = useState<PostmortemContent | null>(
    incident.postmortem ? toContent(incident.postmortem) : null,
  );

  // Resets local edits only when a fresh draft is (re)generated for this
  // incident (generatedAt changes) or the user navigates to a different
  // incident entirely -- never on every incident refetch, so in-progress
  // edits are not silently discarded by e.g. a background refetch. Adjusting
  // state during render (rather than in an effect) avoids the extra render
  // pass an effect-based reset would cause -- see "Adjusting state when a
  // prop changes" in the React docs.
  const draftKey = `${incident.id}:${incident.postmortem?.generatedAt ?? 'none'}`;
  const [trackedDraftKey, setTrackedDraftKey] = useState(draftKey);
  if (draftKey !== trackedDraftKey) {
    setTrackedDraftKey(draftKey);
    setDraft(incident.postmortem ? toContent(incident.postmortem) : null);
  }

  if (!latestRun) {
    return (
      <Alert severity="info" variant="outlined">
        No analysis has been run yet. Run AI analysis first, then a postmortem draft can be
        generated from its results.
      </Alert>
    );
  }

  if (!incident.postmortem || !draft) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          No postmortem draft exists yet. Generate one from the latest analysis run -- every field
          will remain editable afterward, and nothing here is final until a human reviews it.
        </Typography>
        <Button
          variant="contained"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          sx={{ alignSelf: 'flex-start' }}
        >
          {generateMutation.isPending ? 'Generating draft…' : 'Generate postmortem draft'}
        </Button>
        {generateMutation.isError && (
          <Alert severity="error" variant="outlined">
            Postmortem generation failed: {generateMutation.error.message}
          </Alert>
        )}
      </Stack>
    );
  }

  const savedContent = toContent(incident.postmortem);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedContent);
  const markdown = buildPostmortemMarkdown(incident, incident.postmortem);

  function updateField<K extends keyof PostmortemContent>(key: K, value: PostmortemContent[K]): void {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function handleSave(): void {
    if (!draft) return;
    editMutation.mutate(draft);
  }

  return (
    <Stack spacing={3}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Typography variant="subtitle2" color="text.secondary">
              Draft provenance
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Chip label={`Provider: ${incident.postmortem.provider ?? 'unknown'}`} size="small" variant="outlined" />
              <Chip label={`Model: ${incident.postmortem.model ?? 'unknown'}`} size="small" variant="outlined" />
              <Chip
                label={`Drafted: ${incident.postmortem.generatedAt ? new Date(incident.postmortem.generatedAt).toLocaleString() : 'unknown'}`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`Last edited: ${incident.postmortem.lastEditedAt ? new Date(incident.postmortem.lastEditedAt).toLocaleString() : 'never'}`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!isDirty || editMutation.isPending}
        >
          {editMutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
        <Button
          variant="outlined"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? 'Regenerating…' : 'Regenerate draft (discards edits)'}
        </Button>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Button variant="text" onClick={() => downloadMarkdown(`postmortem-${incident.id}.md`, markdown)}>
            Download as Markdown
          </Button>
          <CopyButton value={markdown} label="postmortem Markdown" />
        </Stack>
      </Stack>

      {isDirty && (
        <Alert severity="info" variant="outlined">
          You have unsaved changes.
        </Alert>
      )}
      {editMutation.isError && (
        <Alert severity="error" variant="outlined">
          Saving failed: {editMutation.error.message}
        </Alert>
      )}
      {generateMutation.isError && (
        <Alert severity="error" variant="outlined">
          Regenerating failed: {generateMutation.error.message}
        </Alert>
      )}

      <Divider />

      {CONTENT_FIELDS.map(({ key, label, multiline }) => (
        <TextField
          key={key}
          label={label}
          value={draft[key] as string}
          onChange={(event) => updateField(key, event.target.value as PostmortemContent[typeof key])}
          multiline={multiline}
          minRows={multiline ? 2 : undefined}
          fullWidth
        />
      ))}

      {LIST_FIELDS.map(({ key, label }) => (
        <Stack key={key} spacing={0.5}>
          <Typography variant="subtitle2">{label}</Typography>
          <EditableStringList
            label={label}
            items={draft[key] as string[]}
            onChange={(items) => updateField(key, items as PostmortemContent[typeof key])}
          />
        </Stack>
      ))}
    </Stack>
  );
}
