import type { ReactNode } from 'react';
import { Box, ButtonBase, Stack, Typography, useTheme } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import type { Incident } from '../../../shared/types/incident';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { getInvestigationSteps, type InvestigationStep } from '../../utils/investigationProgress';
import { INCIDENT_STATUS_SELECTOR_TRIGGER_ID } from './IncidentStatusSelector';

interface InvestigationProgressBannerProps {
  incident: Incident;
}

const STATE_LABEL: Record<InvestigationStep['state'], string> = {
  completed: 'Completed',
  current: 'Current step',
  pending: 'Not started',
};

/**
 * Compact, non-intrusive banner guiding the user through the five-step
 * investigation flow derived by `getInvestigationSteps`. Each step is a
 * real button: clicking one switches the workspace to its target tab (or,
 * for "Resolve incident" which has no tab of its own, focuses the status
 * selector in the header). State is conveyed by an icon *and* text label
 * together, never by color alone.
 */
export function InvestigationProgressBanner({ incident }: InvestigationProgressBannerProps): ReactNode {
  const theme = useTheme();
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);
  const steps = getInvestigationSteps(incident);

  function handleStepClick(step: InvestigationStep): void {
    if (step.targetSection) {
      setActiveSection(step.targetSection);
      return;
    }
    document.getElementById(INCIDENT_STATUS_SELECTOR_TRIGGER_ID)?.focus();
  }

  function iconColor(state: InvestigationStep['state']): string {
    if (state === 'completed') return theme.palette.success.main;
    if (state === 'current') return theme.palette.primary.main;
    return theme.palette.text.disabled;
  }

  return (
    <Box
      component="nav"
      aria-label="Investigation progress"
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, px: { xs: 1, sm: 2 }, py: 1 }}
    >
      <Stack
        component="ol"
        direction="row"
        spacing={0.5}
        sx={{ listStyle: 'none', m: 0, p: 0, flexWrap: 'wrap', alignItems: 'stretch' }}
      >
        {steps.map((step) => (
          <Box component="li" key={step.id} sx={{ display: 'flex' }}>
            <ButtonBase
              onClick={() => handleStepClick(step)}
              aria-current={step.state === 'current' ? 'step' : undefined}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1,
                py: 0.75,
                borderRadius: 1,
                textAlign: 'left',
                '&:focus-visible': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: 2,
                },
              }}
            >
              {step.state === 'completed' ? (
                <CheckCircleIcon fontSize="small" aria-hidden="true" sx={{ color: iconColor(step.state) }} />
              ) : (
                <RadioButtonUncheckedIcon
                  fontSize="small"
                  aria-hidden="true"
                  sx={{ color: iconColor(step.state) }}
                />
              )}
              <Stack sx={{ minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: step.state === 'current' ? 700 : 400, whiteSpace: 'nowrap' }}
                >
                  {step.order}. {step.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {STATE_LABEL[step.state]}
                </Typography>
              </Stack>
            </ButtonBase>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
