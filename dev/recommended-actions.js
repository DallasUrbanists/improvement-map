// Synthetic development content, never a claim about an actual city program or request.
export function mockRecommendedActions(suggestion) {
  const summary = suggestion.content?.summary || suggestion.summary || 'this improvement';
  const text = `${summary} ${suggestion.content?.details || ''}`;
  // Prefer the title because the seed descriptions mention several travel modes.
  const topic = /\b(shade|trees?|heat|bus stop)\b/i.test(summary) ? 'shade'
    : /cycl|bik/i.test(summary) ? 'cycling'
      : /cross|walk|sidewalk|pedestrian/i.test(summary) ? 'walking'
        : /\b(shade|trees?|heat)\b/i.test(text) ? 'shade'
          : /cycl|bik/i.test(text) ? 'cycling' : 'walking';
  const profiles = {
    shade: [
      ['Document shade and seating needs', 'Note when the waiting area is exposed to sun, where people wait, and whether seating or an accessible path is missing. Take photos from a safe public location.', 'Observations help explain how heat affects people waiting for transit.'],
      ['Draft a bus stop shade request', 'Prepare a draft describing the stop location, the hottest waiting times, and possible shade or seating improvements. Include access and visibility needs for a future discussion with the responsible agency.', 'A specific draft makes the proposed comfort and accessibility improvements easier to review.'],
      ['Discuss shade options with neighbors', 'Collect feedback about trees, shelters, and seating. Note maintenance and clear-path concerns before choosing an option.', 'Local feedback helps identify shade options that serve people using this stop.'],
    ],
    cycling: [
      ['Document gaps in cycling protection', 'Record where the cycling route loses protection, where turning vehicles cross it, and where parked vehicles obstruct it. Observe from a safe public location.', 'Concrete observations help explain the route’s conflict points.'],
      ['Draft a protected cycling connection request', 'Prepare a draft asking for a review of physical separation, intersection treatments, and connections to nearby cycling routes. Include the street segment and supporting photos.', 'A connected design can address the cycling concerns described in this idea.'],
      ['Collect feedback from people using the route', 'Ask people who cycle, walk, or use nearby businesses about access needs and difficult intersections. Summarize recurring concerns for a future street-design discussion.', 'Feedback helps clarify safety and access needs along the proposed connection.'],
    ],
    walking: [
      ['Document crossing and sidewalk conditions', 'Note missing curb ramps, faded markings, visibility obstructions, and difficult crossing movements. Take photos from a safe public location without entering traffic.', 'Specific observations help explain barriers to a safer walking connection.'],
      ['Draft a pedestrian safety review request', 'Prepare a draft describing the exact location and the walking barriers. List potential improvements such as crossing markings, accessible curb ramps, or a shorter crossing for review by the responsible agency.', 'A focused draft turns the walking concern into concrete questions for a safety review.'],
      ['Gather feedback from nearby pedestrians', 'Ask people using the connection about difficult crossing times and accessibility needs. Summarize their observations alongside the proposed improvement.', 'People using the connection can identify needs that a single site visit may miss.'],
    ],
  };
  const location = suggestion.location?.address || suggestion.location?.description || 'the suggested location';
  return profiles[topic].map(([title, instructions, reason], index) => ({
    id: `mock-${suggestion.id}-${topic}-${index + 1}`,
    recommendableId: `mock-${topic}-${index + 1}`,
    summary: title,
    instructions: `Synthetic mock action for “${summary}” at ${location}.\n\n${instructions}\n\nThis is sample content for local development; no request has been submitted.`,
    reason,
    sourceUrl: '',
    expirationDate: null,
    status: 'suggested',
  }));
}
