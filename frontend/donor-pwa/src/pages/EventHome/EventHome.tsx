/**
 * Event Home Page
 *
 * Displays the event home page with branding and event information.
 * Uses event-specific colors and theming from the database.
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';

import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DressCodeIcon from '@mui/icons-material/Checkroom';
import ContactIcon from '@mui/icons-material/ContactMail';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import {
  Box,
  Card,
  CardContent,
  Container,
  Typography,
  CircularProgress,
  Paper,
  Stack,
  Divider,
  Chip,
  useTheme,
} from '@mui/material';

import { useEventStore } from '@/stores/event-store';
import { useAuthStore } from '@/stores/auth-store';

function EventHome() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const theme = useTheme();

  const { selectedEvent, isLoading, error, fetchEventBySlug, setSelectedEvent } = useEventStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // If not authenticated, redirect to sign-in (or landing page)
    if (!isAuthenticated) {
      navigate('/');
      return;
    }

    // Fetch event by slug if provided and not already loaded
    if (slug && (!selectedEvent || selectedEvent.slug !== slug)) {
      fetchEventBySlug(slug)
        .then((event) => setSelectedEvent(event))
        .catch((err) => {
          console.error('Failed to fetch event:', err);
        });
    }
  }, [slug, isAuthenticated, selectedEvent, fetchEventBySlug, setSelectedEvent, navigate]);

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size={60} />
        <Typography variant="body1" color="text.secondary">
          Loading event...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Error Loading Event
          </Typography>
          <Typography color="text.secondary">{error}</Typography>
        </Paper>
      </Container>
    );
  }

  if (!selectedEvent) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h5" color="text.secondary" gutterBottom>
            No Event Selected
          </Typography>
          <Typography color="text.secondary">
            Please select an event from the dropdown in the header.
          </Typography>
        </Paper>
      </Container>
    );
  }

  // Format event date
  const eventDate = new Date(selectedEvent.event_datetime);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  // Build venue address
  const venueAddress = [
    selectedEvent.venue_address,
    selectedEvent.venue_city,
    selectedEvent.venue_state,
    selectedEvent.venue_zip,
  ]
    .filter(Boolean)
    .join(', ');

  // Event branding colors (fallback to theme primary color)
  const primaryColor = selectedEvent.primary_color || theme.palette.primary.main;

  return (
    <Box sx={{ pb: 4 }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${primaryColor} 0%, ${selectedEvent.secondary_color || primaryColor} 100%)`,
          color: 'white',
          py: 6,
          px: 2,
        }}
      >
        <Container maxWidth="md">
          <Stack spacing={2} alignItems="center" textAlign="center">
            <Typography variant="h3" component="h1" fontWeight="bold">
              {selectedEvent.name}
            </Typography>
            {selectedEvent.tagline && (
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                {selectedEvent.tagline}
              </Typography>
            )}
            <Chip
              label={selectedEvent.status.toUpperCase()}
              sx={{
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 'bold',
              }}
            />
          </Stack>
        </Container>
      </Box>

      {/* Event Details */}
      <Container maxWidth="md" sx={{ mt: -4 }}>
        <Card elevation={4}>
          <CardContent sx={{ p: 4 }}>
            {/* Date & Time */}
            <Stack direction="row" spacing={2} alignItems="center" mb={3}>
              <CalendarTodayIcon color="primary" fontSize="large" />
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  {formattedDate}
                </Typography>
                <Typography color="text.secondary">
                  {formattedTime} ({selectedEvent.timezone})
                </Typography>
              </Box>
            </Stack>

            <Divider sx={{ my: 2 }} />

            {/* Venue */}
            {(selectedEvent.venue_name || venueAddress) && (
              <>
                <Stack direction="row" spacing={2} alignItems="flex-start" mb={3}>
                  <LocationOnIcon color="primary" fontSize="large" />
                  <Box>
                    {selectedEvent.venue_name && (
                      <Typography variant="h6" fontWeight="bold">
                        {selectedEvent.venue_name}
                      </Typography>
                    )}
                    {venueAddress && (
                      <Typography color="text.secondary">{venueAddress}</Typography>
                    )}
                  </Box>
                </Stack>
                <Divider sx={{ my: 2 }} />
              </>
            )}

            {/* Attire */}
            {selectedEvent.attire && (
              <>
                <Stack direction="row" spacing={2} alignItems="center" mb={3}>
                  <DressCodeIcon color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      Dress Code
                    </Typography>
                    <Typography color="text.secondary">{selectedEvent.attire}</Typography>
                  </Box>
                </Stack>
                <Divider sx={{ my: 2 }} />
              </>
            )}

            {/* Contact */}
            {selectedEvent.primary_contact_name && (
              <>
                <Stack direction="row" spacing={2} alignItems="flex-start" mb={3}>
                  <ContactIcon color="primary" fontSize="large" />
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      Contact
                    </Typography>
                    <Typography>{selectedEvent.primary_contact_name}</Typography>
                    {selectedEvent.primary_contact_email && (
                      <Typography color="text.secondary">
                        {selectedEvent.primary_contact_email}
                      </Typography>
                    )}
                    {selectedEvent.primary_contact_phone && (
                      <Typography color="text.secondary">
                        {selectedEvent.primary_contact_phone}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Divider sx={{ my: 2 }} />
              </>
            )}

            {/* Description */}
            {selectedEvent.description && (
              <Box mt={3}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  About This Event
                </Typography>
                <Typography color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedEvent.description}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* Sponsors Section */}
        {selectedEvent.sponsors && selectedEvent.sponsors.length > 0 && (
          <Card elevation={2} sx={{ mt: 4 }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom textAlign="center">
                Our Sponsors
              </Typography>
              <Stack
                direction="row"
                spacing={4}
                flexWrap="wrap"
                justifyContent="center"
                alignItems="center"
                sx={{ mt: 2 }}
              >
                {selectedEvent.sponsors.map((sponsor) => (
                  <Box key={sponsor.id} sx={{ textAlign: 'center' }}>
                    {sponsor.logo_url ? (
                      <Box
                        component="img"
                        src={sponsor.logo_url}
                        alt={sponsor.name}
                        sx={{
                          maxWidth:
                            sponsor.logo_size === 'large'
                              ? 200
                              : sponsor.logo_size === 'medium'
                                ? 150
                                : 100,
                          maxHeight: 80,
                          objectFit: 'contain',
                        }}
                      />
                    ) : (
                      <Typography variant="body1">{sponsor.name}</Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Container>
    </Box>
  );
}

export default EventHome;
