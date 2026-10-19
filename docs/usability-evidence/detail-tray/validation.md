# Detail tray and navigation verification

- Content-fitting bottom-anchored tray, capped at the previous portrait reading area; short landscape uses more height. Accordion reading offset is preserved when possible, clamped when content shrinks, and yields to user/focus scrolling. Heading remains visible.
- Map recentering waits for resize activity to settle. Headline fit reserves 24–72px side insets and 16–32px bottom spacing; short headlines can remain large. Reviewed actual local suggestion 28 in title-spacing.png.
- 36 focused tests passed across Android Chromium and iPhone WebKit, light/dark: 360×880, 412×915, 880×360 tray geometry/scroll/async-content cases, 320/360/412px photo/accessibility cases, and existing Browse/detail journeys. Tray tests enable animations; photo tests cover reduced motion.
- 5 navigation tests passed across both mobile engines/themes and desktop Chromium: left/right navigation, locked loading, touch taps without sticky tooltips, mouse hover, keyboard focus. Inspected loading-current.png.
- Production build passed (existing chunk-size warnings); git diff whitespace check passed.
- Physical Flip6 Chrome/Samsung Internet testing remains a release check. The gray-box replacement was subsequently approved and implemented: readable labels, subtle content dimming, a 3px header progress line with static reduced-motion fallback, and preserved interaction locks. Header tooltips now sit above the tray and include Refresh and Close; hover remains restricted to mouse-capable devices.
