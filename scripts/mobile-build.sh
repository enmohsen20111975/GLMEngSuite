#!/bin/bash
# Mobile build script for EngiSuite Analytics
# This script configures and builds the Next.js app for mobile deployment via Capacitor

set -e

echo "📱 EngiSuite Analytics - Mobile Build Script"
echo "============================================="
echo ""

# Check if Capacitor is initialized
if [ ! -f "capacitor.config.ts" ]; then
  echo "❌ capacitor.config.ts not found. Run this from the project root."
  exit 1
fi

MODE="${1:-remote}"

case "$MODE" in
  remote)
    echo "🌐 Remote Server URL Mode (Recommended)"
    echo "---------------------------------------"
    echo ""
    echo "In this mode, the Capacitor app loads content from your deployed"
    echo "Hostinger server. API routes work natively through the server."
    echo ""
    echo "Steps:"
    echo "  1. Update capacitor.config.ts → server.url with your deployed URL"
    echo "     Example: url: 'https://your-domain.com'"
    echo "  2. Add native platforms:"
    echo "     npx cap add android"
    echo "     npx cap add ios"
    echo "  3. Sync and open:"
    echo "     npx cap sync"
    echo "     npx cap open android   # Opens Android Studio"
    echo "     npx cap open ios       # Opens Xcode"
    echo ""
    echo "✅ No static export needed - the app loads from the remote server."
    ;;

  static)
    echo "📦 Static Export Mode (Offline-capable)"
    echo "----------------------------------------"
    echo ""
    echo "WARNING: This mode requires output: 'export' in next.config.ts"
    echo "API routes will NOT work in this mode. Use remote mode instead."
    echo ""
    echo "Steps for static export:"
    echo "  1. Temporarily set output: 'export' in next.config.ts"
    echo "  2. Run: bun run build"
    echo "  3. Copy static files: cp -r out/ www/ (if needed)"
    echo "  4. Sync: npx cap sync"
    echo "  5. Revert next.config.ts back to output: 'standalone'"
    ;;

  add-android)
    echo "🤖 Adding Android platform..."
    npx cap add android
    echo "✅ Android platform added. Run 'npx cap open android' to open in Android Studio."
    ;;

  add-ios)
    echo "🍎 Adding iOS platform..."
    npx cap add ios
    echo "✅ iOS platform added. Run 'npx cap open ios' to open in Xcode."
    ;;

  sync)
    echo "🔄 Syncing Capacitor..."
    npx cap sync
    echo "✅ Sync complete."
    ;;

  *)
    echo "Usage: ./scripts/mobile-build.sh [command]"
    echo ""
    echo "Commands:"
    echo "  remote        Show instructions for remote server URL mode (default)"
    echo "  static        Show instructions for static export mode"
    echo "  add-android   Add Android platform"
    echo "  add-ios       Add iOS platform"
    echo "  sync          Sync web assets to native platforms"
    ;;
esac
