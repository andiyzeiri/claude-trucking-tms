#!/bin/bash

# Deploy Google Maps inline editing feature
cd /home/andi/claude-trucking-tms

git add frontend/src/app/loads/page.tsx

git commit -m "Add Google Maps API mileage auto-calculation to inline load editing

- Added Google Maps API call to stopLocationEdit function
- Automatically calculates miles when both pickup and delivery locations are filled
- Shows toast notification with calculated miles
- Updates both local state and backend with calculated miles
- Works with the inline editing system used in loads page

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

git push origin main

echo "✅ Deployment complete! Netlify will deploy automatically in 1-2 minutes."
