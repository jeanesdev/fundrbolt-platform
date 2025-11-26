/**
 * Event Selector Component
 *
 * Displays a dropdown for selecting between registered events.
 * Shows the current event name and allows switching between events.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EventIcon from '@mui/icons-material/Event';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';

import { useNotifications } from '@toolpad/core/useNotifications';

import { useEventStore } from '@/stores/event-store';
import { useAuthStore } from '@/stores/auth-store';

function EventSelector() {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const {
    selectedEvent,
    registeredEvents,
    registeredEventsLoaded,
    isLoading,
    fetchRegisteredEvents,
    selectEvent,
  } = useEventStore();

  const { isAuthenticated } = useAuthStore();

  // Fetch registered events on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && !registeredEventsLoaded) {
      fetchRegisteredEvents().catch(console.error);
    }
  }, [isAuthenticated, registeredEventsLoaded, fetchRegisteredEvents]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    // Only show dropdown if user has multiple events
    if (registeredEvents.length > 1) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleEventSelect = async (eventId: string) => {
    handleClose();

    // Find the event in registered events to get slug
    const registration = registeredEvents.find((r) => r.event_id === eventId);
    const slug = registration?.event?.slug;

    try {
      await selectEvent(eventId);
      // Navigate to event home page
      if (slug) {
        navigate(`/events/${slug}`);
      }
    } catch (error) {
      console.error('Failed to select event:', error);
      notifications.show('Failed to load event. Please try again.', {
        severity: 'error',
        autoHideDuration: 5000,
      });
    }
  };

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  // Show loading state
  if (isLoading && !registeredEventsLoaded) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <CircularProgress size={20} color="inherit" />
        <Typography variant="body2" color="text.secondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  // Show nothing if no registered events
  if (registeredEventsLoaded && registeredEvents.length === 0) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <EventIcon color="disabled" />
        <Typography variant="body2" color="text.secondary">
          No events
        </Typography>
      </Box>
    );
  }

  const showDropdownArrow = registeredEvents.length > 1;

  return (
    <>
      <Button
        color="inherit"
        onClick={handleClick}
        startIcon={<EventIcon />}
        endIcon={showDropdownArrow ? <ArrowDropDownIcon /> : undefined}
        sx={{
          textTransform: 'none',
          minWidth: 'auto',
        }}
        aria-controls={open ? 'event-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 500,
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedEvent?.name || 'Select Event'}
        </Typography>
      </Button>

      {showDropdownArrow && (
        <Menu
          id="event-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          MenuListProps={{
            'aria-labelledby': 'event-selector-button',
          }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          {registeredEvents.map((registration) => (
            <MenuItem
              key={registration.id}
              onClick={() => handleEventSelect(registration.event_id)}
              selected={registration.event_id === selectedEvent?.id}
            >
              <ListItemIcon>
                <EventIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={registration.event?.name || 'Unknown Event'}
                secondary={
                  registration.event?.event_datetime
                    ? new Date(registration.event.event_datetime).toLocaleDateString()
                    : undefined
                }
              />
            </MenuItem>
          ))}
        </Menu>
      )}
    </>
  );
}

export default EventSelector;
