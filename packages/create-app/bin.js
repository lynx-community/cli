#!/usr/bin/env node

import { createApp } from './dist/index.js';

createApp().catch((error) => {
  console.error(error);
  process.exit(1);
});
