// server/courtSources.js
//
// The six venues. Field names match what scraper.js reads, so these rows can
// also be inserted into your courts table (check_url, booking_url, platform).
//
// maxAdvanceDays: how many days ahead that venue lets people book (e.g. 7 or
// 14). null = unknown. Find out by clicking forward in each site's calendar
// until the days go grey, then count from today. When set, searches beyond it
// skip the scrape and show "Bookings open up to N days ahead".
//
// Fill in `location` (shown under the court name) and rename the two
// Sports360 hubs; I couldn't read their names from the app, so those are
// placeholders. Names for the others come from their URLs.

export default [
  {
    id: 'sports360-hub-e2bc3770',
    name: 'The Court Avenue',
    location: 'TCA GENESIS WAREHOUSE, MacArthur Hwy, San Isidro, San Fernando, 2001 Pampanga',
    platform: 'sports360',
    maxAdvanceDays: null,
    check_url:
      'https://app.sports360.ph/player-dashboard/court-rental?hub=e2bc3770-0353-4a6e-a885-377cdebd968a&date=2026-10-09',
    booking_url:
      'https://app.sports360.ph/player-dashboard/court-rental?hub=e2bc3770-0353-4a6e-a885-377cdebd968a',
  },
  {
    id: 'sports360-hub-7ea522d6',
    name: 'Guagua Pickleball Arena',
    location: 'Center, San Matias, Guagua, Pampanga',
    platform: 'sports360',
    maxAdvanceDays: null,
    check_url:
      'https://app.sports360.ph/player-dashboard/court-rental?hub=7ea522d6-6bf6-4ab2-93f9-4217919e4d4f&date=2026-10-09',
    booking_url:
      'https://app.sports360.ph/player-dashboard/court-rental?hub=7ea522d6-6bf6-4ab2-93f9-4217919e4d4f',
  },
  {
    id: 'pampanga-pickleball',
    name: 'Pampanga Pickleball',
    location: 'Lot 2, Warehouse 1, Brgy, Telabastagan, San Fernando, 2000 Pampanga',
    platform: 'rezerv',
    maxAdvanceDays: null,
    check_url:
      'https://pampanga-pickleball.rezerv.co/appointment-booking?apptId=bf7a4041-9c57-41e9-ba2a-3ec57b655414&locationId=831272d0-4add-490c-a0d0-315cb498f6e5&durationId=6ec466d4-4008-47e4-8eeb-3d974275f57c',
    booking_url:
      'https://pampanga-pickleball.rezerv.co/appointment-booking?apptId=bf7a4041-9c57-41e9-ba2a-3ec57b655414&locationId=831272d0-4add-490c-a0d0-315cb498f6e5&durationId=6ec466d4-4008-47e4-8eeb-3d974275f57c',
  },
  {
    id: 'junglebase',
    name: 'Junglebase',
    location: 'MacArthur Highway, cor Marlboro, Barangay Telabastagan, San Fernando, Pampanga',
    platform: 'rezerv',
    maxAdvanceDays: null, // same appointment-booking URL shape as Rezerv
    check_url:
      'https://www.junglebase.ph/appointment-booking?apptId=b9e1c0f7-6b9a-402f-9585-791f08935d8b&locationId=7fcb1aee-ec21-40bf-8de6-1b9b76d6f241&durationId=5dee80d3-21b5-4717-a743-507af0a1d69a',
    booking_url:
      'https://www.junglebase.ph/appointment-booking?apptId=b9e1c0f7-6b9a-402f-9585-791f08935d8b&locationId=7fcb1aee-ec21-40bf-8de6-1b9b76d6f241&durationId=5dee80d3-21b5-4717-a743-507af0a1d69a',
  },
  {
    id: 'pickle-place',
    name: 'Pickle Place',
    location: '5J74+3X5, Angeles, Pampanga',
    platform: 'coura',
    maxAdvanceDays: null,
    // The long ?_gl=... tracking part of your link is dropped; it isn't needed.
    check_url: 'https://coura.one/court/63/guest?name=Pickle%20Place',
    booking_url: 'https://coura.one/court/63/guest?name=Pickle%20Place',
  },
  {
    id: 'ground-002',
    name: 'Ground 002',
    location: 'Vista Mall, San Agustin, San Fernando, 2000 Pampanga',
    platform: 'ground002',
    check_url: 'https://www.ground002.com',
    booking_url: 'https://www.ground002.com',
  },
];