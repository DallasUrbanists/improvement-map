export const locations = [
  { id: 'ChIJ-local-dallas-city-hall', address: 'Dallas City Hall, 1500 Marilla St, Dallas, TX', lat: 32.7767, lng: -96.797 },
  { id: 'ChIJ-local-elm-akard-crossing', address: 'Elm Street & Akard Street, Dallas, TX', lat: 32.7812, lng: -96.799 },
  { id: 'ChIJ-local-main-street-garden', address: 'Main Street Garden, Dallas, TX', lat: 32.7801, lng: -96.7935 },
];

export function seedSuggestions() {
  return locations.map((location, index) => ({
    id: index + 1, creationDate: '2026-10-01T12:00:00Z', createdAt: '2026-10-01T12:00:00Z', status: 'open',
    emoji: ['🚶', '🚲', '🌳'][index], author: { name: 'Local Contributor', email: 'contributor@example.invalid' },
    content: {
      summary: ['Add a safer crossing near City Hall', 'Protect people cycling on Elm Street', 'Add shade near the bus stop'][index],
      details: 'Synthetic local development suggestion. Improve this connection for people walking, cycling and using transit.',
      photos: [{ id: `local-photo-${index + 1}`, url: '/__mock/crossing.svg', caption: 'Synthetic crossing illustration' }],
    },
    location: { latitude: location.lat, longitude: location.lng, address: location.address, description: 'Synthetic local fixture' },
  }));
}
