const BASE = import.meta.env.VITE_API_BASE_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://dinksync-backend.onrender.com' // Replace with your actual Render backend URL
);

async function request(path, options) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    // Try to use the API's own message; fall back to the status line.
    let message = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.error) message = body.error
    } catch {
      // The body was not JSON. The status line is all we have.
    }
    throw new Error(message)
  }

  return response.status === 204 ? null : response.json()
}

// GET /api/courts?date=YYYY-MM-DD&start=HH:mm&end=HH:mm
// Returns an array of:
//   { id, name, location, available, bookmarked, bookingUrl }
export const listCourts = (filters = {}) => {
  const query = new URLSearchParams(filters).toString()
  return request(`/api/courts${query ? `?${query}` : ''}`)
}

// POST /api/courts/:id/bookmark   body: { bookmarked: boolean }
// Returns the updated court.
export const setBookmark = (id, bookmarked) =>
  request(`/api/courts/${id}/bookmark`, {
    method: 'POST',
    body: JSON.stringify({ bookmarked }),
  })

  // Add this to client/src/api/httpApi.js

  export const fetchCourtAvailability = (date, time) => {
    const query = new URLSearchParams({ date, time }).toString()
    return request(`/api/courts/check?${query}`)
  }