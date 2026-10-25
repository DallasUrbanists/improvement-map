// Fictional people and districts for development, never real officeholder assignments.
// Reserved domains and 555-01xx numbers keep contact actions synthetic too.
export function mockRepresentatives(suggestion) {
  const offices = [
    ['Avery Morgan', 'Council member', 'City of Dallas (synthetic)', 'City Council', 'Mock District A'],
    ['Jordan Ellis', 'County commissioner', 'Dallas County (synthetic)', 'Commissioners Court', 'Mock Precinct B'],
    ['Casey Rivera', 'State representative', 'Texas (synthetic)', 'House of Representatives', 'Mock District C'],
    ['Taylor Brooks', 'U.S. representative', 'United States (synthetic)', 'House of Representatives', 'Mock District D'],
  ];
  return offices.map(([name, title, entityName, bodyName, districtName], index) => ({
    id: `mock-representative-${suggestion.id}-${index + 1}`,
    name: `${name} (synthetic)`,
    title,
    boundary: { entityName, bodyName, districtName },
    emails: [`office-${index + 1}@representatives.example.invalid`],
    phones: [`+1214555010${index}`],
    webpage_url: `https://representatives.example.invalid/office-${index + 1}`,
  }));
}
