<!-- Temporary reference: accordion sections removed from SubmissionDetailView.vue. -->
<template>
  <Accordion v-if="photosList.length" v-model:open="photosOpen" :theme="isDark ? 'dark' : 'light'" :surface-level="2" :header="{ label: `Photos (${photosList.length})` }">
    <div class="detail-photo-content">
      <div class="detail-photo-row">
        <button v-for="(photo, index) in photosList" :key="photo.id || index" type="button" class="detail-photo-thumbnail" :aria-label="`Open photo ${index + 1}${photo.caption ? ': ' + photo.caption : ''}`" @click="previewPhoto(index, $event.currentTarget)">
          <img :src="photo.dataUrl || photo.url" alt="" />
          <span v-if="photo.caption" class="detail-photo-caption">{{ photo.caption }}</span>
        </button>
      </div>
    </div>
  </Accordion>

  <Accordion v-model:open="areasOpen" class="areas-section" :theme="isDark ? 'dark' : 'light'" :surface-level="2" :key="`areas-${suggestion.id}`" :header="{ label: 'Neighborhoods & districts' }" @update:open="value => value && loadBoundaries()">
    <p v-if="boundariesLoading" role="status">Loading areas…</p>
    <div v-else-if="boundariesError" role="alert"><p>{{ boundariesError }}</p><button class="action-button" @click="loadBoundaries">Retry</button></div>
    <p v-else-if="boundariesLoaded && !boundaries.length">No areas found.</p>
    <article v-for="boundary in prioritizedBoundaries" :key="boundary.id" class="context-card">
      <h3>{{ [boundary.bodyName, boundary.districtName].filter(Boolean).join(' · ') || boundary.entityName || 'Area' }}</h3>
      <p class="secondary-copy">{{ boundary.entityName && boundary.entityName !== boundary.districtName ? boundary.entityName : '' }}</p>
      <p v-if="boundary.description">{{ boundary.description }}</p>
      <p v-if="boundary.whenToContact"><strong>When to contact:</strong> {{ boundary.whenToContact }}</p>
    </article>
  </Accordion>

  <Accordion v-model:open="representativesOpen" class="representatives-section" :theme="isDark ? 'dark' : 'light'" :surface-level="2" :key="`representatives-${suggestion.id}`" :header="{ label: 'Representatives' }" @update:open="value => value && loadRepresentatives()">
    <p v-if="representativesLoading" role="status">Loading representatives…</p>
    <div v-else-if="representativesError" role="alert"><p>{{ representativesError }}</p><button class="action-button" @click="loadRepresentatives">Retry</button></div>
    <p v-else-if="representativesLoaded && !representatives.length">No representatives found.</p>
    <article v-for="representative in prioritizedRepresentatives" :key="representative.id" class="context-card">
      <div class="representative-row-copy">
        <h3>{{ representative.name || 'Name unavailable' }}</h3>
        <p class="secondary-copy"><template v-if="representative.title">{{ representative.title }}<br /></template>{{ [representative.boundary?.entityName, representative.boundary?.bodyName, representative.boundary?.districtName].filter(Boolean).join(' · ') || 'Jurisdiction unavailable' }}</p>
      </div>
      <div class="action-card-controls representative-contact-controls">
        <details v-if="getRepresentativeContactItems(representative).length" class="representative-contact-menu" @toggle="positionRepresentativeContactMenu">
          <summary class="action-button"><i class="fa-solid fa-address-card" aria-hidden="true"></i> Contact</summary>
          <div class="representative-contact-options">
            <a v-for="contact in getRepresentativeContactItems(representative)" :key="contact.href + contact.label" :href="contact.href" :target="contact.external ? '_blank' : undefined" :rel="contact.external ? 'noopener noreferrer' : undefined" class="action-button" :aria-label="`${contactLabel(contact)}: ${contact.label}`" :title="contact.label"><i :class="['fa-solid', contact.external ? 'fa-globe' : contact.type === 'email' ? 'fa-envelope' : 'fa-phone']" aria-hidden="true"></i><span>{{ contact.buttonLabel }}</span></a>
          </div>
        </details>
      </div>
      <p v-if="!getRepresentativeContactItems(representative).length" class="secondary-copy">Contact information unavailable</p>
    </article>
  </Accordion>
  <StreetmixPanel v-if="String(suggestion.id) === String(route.params.id)" :key="suggestion.id" :suggestion="suggestion" :theme="isDark ? 'dark' : 'light'" :surface-level="2" :refresh-version="actionsRefreshVersion" @saved="updateStreetmixSummary" />

  <RecommendedActions :suggestion="suggestion" :theme="isDark ? 'dark' : 'light'" :surface-level="2" :refresh-version="actionsRefreshVersion" />

</template>
