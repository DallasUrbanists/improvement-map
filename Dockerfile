# Node is shared by Vite, Storybook, the mock service and browser tests.
FROM node:24.21.0-bookworm@sha256:3d27e5c11e5786e309ec3e03f93ae536eb36e6e5eb3714d5eb3300a36157add0 AS development
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright-browsers \
    STORYBOOK_DISABLE_TELEMETRY=1 \
    npm_config_update_notifier=false
WORKDIR /opt/development
COPY package.json package-lock.json ./
COPY scripts/playwright-task.js ./scripts/playwright-task.js
RUN npm ci --no-audit --no-fund \
    && npm run playwright:install -- --with-deps chromium webkit \
    && node -e "require('fs').writeFileSync('dependency-lock.sha256', require('crypto').createHash('sha256').update(require('fs').readFileSync('package-lock.json')).digest('hex'))" \
    && chmod -R a+rX /opt/development /opt/playwright-browsers
COPY scripts/local-development/container-entrypoint.js /opt/container-entrypoint.js
WORKDIR /workspace
ENTRYPOINT ["node", "/opt/container-entrypoint.js"]
CMD ["npm", "run", "dev:local", "--", "--host", "0.0.0.0"]
