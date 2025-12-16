#!/bin/bash

# ios.sh - Build iOS app with automatic dev server IP detection

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Detecting development server IP address...${NC}"

# Function to detect IP on macOS (only platform needed for iOS development)
detect_ip() {
    # macOS
    route get default | grep interface | awk '{print $2}' | xargs ifconfig | grep -E "inet [0-9]" | grep -v 127.0.0.1 | awk '{print $2}' | head -n1
}

# Try to detect the IP
DEV_SERVER_IP=$(detect_ip)

if [ -z "$DEV_SERVER_IP" ]; then
    echo -e "${YELLOW}⚠️  Could not automatically detect IP address${NC}"
    echo -e "${YELLOW}Please enter your development server IP address:${NC}"
    read -p "IP Address: " DEV_SERVER_IP

    if [ -z "$DEV_SERVER_IP" ]; then
        echo -e "${RED}❌ No IP address provided. Using localhost fallback.${NC}"
        DEV_SERVER_IP="localhost"
    fi
fi

if [ -n "$DEV_SERVER_IP" ]; then
    echo -e "${GREEN}✅ Using development server IP: $DEV_SERVER_IP${NC}"
else
    echo -e "${YELLOW}⚠️  Will use localhost fallback${NC}"
    DEV_SERVER_IP="localhost"
fi

# Try to detect the IP
DEV_SERVER_IP=$(detect_ip)

if [ -z "$DEV_SERVER_IP" ]; then
    echo -e "${YELLOW}⚠️  Could not automatically detect IP address${NC}"
    echo -e "${YELLOW}Please enter your development machine's IP address:${NC}"
    read -p "IP Address: " DEV_SERVER_IP

    if [ -z "$DEV_SERVER_IP" ]; then
        echo -e "${RED}❌ No IP address provided. Using localhost fallback.${NC}"
        DEV_SERVER_IP="localhost"
    fi
fi

if [ -n "$DEV_SERVER_IP" ]; then
    echo -e "${GREEN}✅ Using development server IP: $DEV_SERVER_IP${NC}"
else
    echo -e "${YELLOW}⚠️  Will use localhost fallback${NC}"
    DEV_SERVER_IP="localhost"
fi

# Check if we're on macOS (required for iOS development)
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}❌ iOS development requires macOS and Xcode${NC}"
    echo -e "${YELLOW}📱 Please run this script on a macOS machine with Xcode installed${NC}"
    echo -e "${YELLOW}💡 For now, the iOS app has been configured to use: $DEV_SERVER_IP${NC}"
    echo -e "${YELLOW}🔧 You'll need to manually open the Xcode project to build: apple/HelloWorld.xcodeproj${NC}"
    exit 1
fi

# Change to iOS project directory
cd "apple"

echo -e "${GREEN}🔨 Building iOS app...${NC}"

# Build the iOS app with the detected IP
if [ -n "$DEV_SERVER_IP" ]; then
    # Set environment variable for the build
    export DEV_SERVER_HOST="$DEV_SERVER_IP"
    
    # Build for iOS simulator (development)
    xcodebuild -project HelloWorld.xcodeproj -scheme HelloWorld -destination 'platform=iOS Simulator,name=iPhone 15' clean build
    
    echo -e "${GREEN}✅ Build complete!${NC}"
    echo -e "${GREEN}📱 App built for iOS simulator${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Optionally open iOS simulator and install app if available
if command -v xcrun &> /dev/null; then
    echo -e "${YELLOW}📱 Opening iOS Simulator...${NC}"
    # Open the default iOS simulator
    xcrun simctl boot "iPhone 15" &> /dev/null || true
    
    # Find the most recently built app in derived data
    # The template system will have replaced "HelloWorld" with the actual project name
    APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -name "*.app" -type d -path "*/Build/Products/*" 2>/dev/null | head -n1)
    
    if [ -n "$APP_PATH" ]; then
        echo -e "${YELLOW}📲 Installing app on simulator...${NC}"
        # Install the app on the simulator
        xcrun simctl install "iPhone 15" "$APP_PATH"
        echo -e "${GREEN}✅ App installed successfully on simulator!${NC}"
        
        echo -e "${YELLOW}🚀 Launching app...${NC}"
        # Launch the app (bundle ID will be whatever the template system generated)
        xcrun simctl launch "iPhone 15" "$(basename "$APP_PATH" .app)"
    else
        echo -e "${YELLOW}⚠️  App not found in derived data${NC}"
        echo -e "${YELLOW}💡 You can manually launch the app from Xcode${NC}"
        echo -e "${YELLOW}🔧 Look for your app in Xcode's Products folder${NC}"
    fi
else
    echo -e "${YELLOW}📱 xcrun not found. Simulator management skipped${NC}"
fi

if [ -n "$DEV_SERVER_IP" ]; then
    echo -e "${GREEN}🚀 Start your development server with:${NC}"
    echo -e "${GREEN}   cd project && npm run dev${NC}"
    echo -e "${GREEN}🌐 Server should be accessible at: http://$DEV_SERVER_IP:3000${NC}"
fi