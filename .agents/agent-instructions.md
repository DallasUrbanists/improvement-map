# PURPOSE

The purpose of this web app is to provide a user-friendly, touch-friendly, mobile-first web tool for pedestrians, cyclists, and transit users to submit public improvement suggestions while they're on the go. Suggestions can be submitted by anyone, requiring at minimum a name, email, summary, and location. Optionally suggestion may also include a detailed description, a location description, and up to 10 photos with captions.

In addition to submitting suggestions, users should be able to browse previously submitted suggestions. There are two modes for browsing suggestions: "List view" and "Map view".

# TECH STACK

Refactor this project into a progressive web app with the following tech stack:

- Git
- JavaScript
- NPM
- Vue JS
- Tailwind CSS
- Google Maps API
- Nomatim API (for address search)
- Turf JS (for geospatial functions) 
- FontAwesome icons
- Playwright

# BACK-END API WEB SERVICE

http://api.dallasurbanists.org/swagger

# FRONT-END STYLING

Front-end styling should use styles, fonts, and colors from https://www.strongtowns.org/resources/brand

User should be able to toggle between dark mode and light mode. Dark mode should be the default.

The UI/UX should be very
- user friendly
- touch friendly
- mobile first
- high contrast
- wizard-style forms

# PAGES

Across all pages there should be a navbar for moving between the three main pages:

## HOME PAGE 

When users load the web app, they should be presented with the home screen. The homepage presents a live activity log of the most recent suggestions. The homepage should update in near real-time as new suggestions are detected (i.e. 30 second polling).

## SUBMIT PAGE

This is a wizard-style form for submitting new suggestions. Page has a progress bar. Progress should be saved in local storage until the final submission to assure progress isn't lost in case of page refresh. HTTP POST request doesn't happen until submission at the final step. Upon final submission, clear the form for next new entry.

The wizard steps are as follows:

### STEP ONE: Describe

User inputs the summary and details of their suggestion. Both fields are required. Click "Next" to continue.

### STEP TWO: Locate

Render a full viewport map for choosing. Browser requests permission to access user's GPS location to automatically pin on map. User taps to set location manually. User can pan and zoom around map.

Map has a search bar overlay for searching street addresses. As user types in search bar, dropdown with autocomplete options appear. When user clicks/touches options, pin moves to location, pans and zooms.

Map has overlay button labeled "Describe location" that user can optionally click/tap to open a modal dialog box for inputting text description of location. User clicks "Okay" button to keep their description, "Discard" to discard to close modal without saving descriptin.

Map has overlay button for recentering map and pin on current GPS coordinates; it also triggers browser request for GPS permission if it wasn't already granted.

When ready, user clicks "Next" button below the map to continue.

### STEP THREE: Photo

User can optionally submit up to 10 photos to accompany their submission. User can either click "Upload" to pick a photo from their device, or click "Camera" to activate the user's device camera. User has options to add and remove photos. For each photo uploaded, user can optionally add caption.

When ready, user clicks "Next" button to continue.

### STEP FOUR: Review & Submit

User is presented with summary view of all their submission details. This section has subheadings for each of the previous steps. Clicking "Edit" next to any subheading navigates to the corresponding page.

At the bottom of all the review details are two text inputs: Name and Email. Both fields are required. Name has 70 character limit. Email must be a valid email format.

When ready, user clicks "Submit" to finalize the suggestion and post to cloud api.

### SUBMISSION IN PROGRESS

The navbar is not available at all on this screen. If user attempts to close or leave page while submissionis in progress, throw browser dialog warning.

Upon submitting, user is presented with a loading page. On this page, user can see:
- spinner
- progress bar
- dynamic text describing what's currently happening as progress is made

Upon successful submission:
- spinner replaced with big green checkmark
- dynamic text says "Submission complete!"
- button appears labeled "View suggestion"

Upon failed submission:
- spinner replaced with yellow warning icon
- dynamic text replaced with "Submission failed: " and error message
- button appears labeled "Go to home"

## BROWSE PAGE

On this page, there are two tabs: "Map" and "List"

### MAP VIEW

Map view presents a full viewport map, centered on the user's location by default. Markers are placed everywhere there is a suggestion. Clicking/touching a marker opens a popup with the following:
- summary
- photo
- link to "view suggestion"

Map has a search bar overlay for searching street addresses. As user types in search bar, dropdown with autocomplete options appear. Touching an autocomplete option pans and zooms map to location.

### LIST VIEW

List shows suggestions as cards. Each card has three elements:

- summary
- photo thumbnail
- link to "view suggestion"

By default, the suggestions are sorted by distance from user's current GPS location, closest at the top. If browser not yet given permission, trigger permission request upon page load and show suggestions in order of timestamp, newest first. Upon receiving permission to GPS location, refresh list sorted by distance.

## VIEW SUBMISSION PAGE

This page allows users to view all details and photos about a submission.

# OPTIMIZATION

Minimize excessive API calls using caching techniques.

# TESTING

Use Playwright to write automated tests that can be used for regression testing for future development.

# DOCUMENTATION

Update the README.md file according to these requirements.