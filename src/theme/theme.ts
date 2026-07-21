import { createTheme } from '@mui/material/styles';

/**
 * Application design tokens.
 *
 * IncidentIQ favors a calm, trustworthy "engineering dashboard" aesthetic
 * (light surfaces, muted blue accent, restrained color usage) so that visual
 * emphasis is reserved for evidence and severity, not decoration.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    background: {
      default: '#ffffff',
      paper: '#f7f8fa',
    },
    primary: {
      main: '#3457d5',
      light: '#5b78de',
      dark: '#25409e',
      contrastText: '#ffffff',
    },
    warning: {
      main: '#b7791f',
    },
    error: {
      main: '#c0362c',
    },
    success: {
      main: '#1f7a4d',
    },
    text: {
      primary: '#1a1d23',
      secondary: '#5a6270',
    },
    divider: '#e2e5ea',
  },
  typography: {
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  spacing: 8,
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: '1px solid #e2e5ea',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          borderBottom: '1px solid #e2e5ea',
        },
      },
    },
  },
});
