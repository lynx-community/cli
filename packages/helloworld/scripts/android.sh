#!/bin/bash

# android.sh - Build Android app with automatic dev server IP detection

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Detecting development server IP address...${NC}"

# Function to detect IP on different platforms
detect_ip() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        ip -4 addr show $(ip route show default | awk '{print $5}' | head -n1) 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -n1
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        route get default | grep interface | awk '{print $2}' | xargs ifconfig | grep -E "inet [0-9]" | grep -v 127.0.0.1 | awk '{print $2}' | head -n1
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        # Windows (Git Bash/MSYS2)
        ipconfig | grep -A 5 "Wireless LAN adapter Wi-Fi\|Ethernet adapter" | grep "IPv4 Address" | head -n1 | sed 's/.*: //'
    else
        echo -e "${YELLOW}⚠️  Unknown OS type: $OSTYPE${NC}"
        echo -e "${YELLOW}Please manually specify your IP address${NC}"
        return 1
    fi
}

# Try to detect the IP
DEV_SERVER_IP=$(detect_ip)

if [ -z "$DEV_SERVER_IP" ]; then
    echo -e "${YELLOW}⚠️  Could not automatically detect IP address${NC}"
    echo -e "${YELLOW}Please enter your development machine's IP address:${NC}"
    read -p "IP Address: " DEV_SERVER_IP

    if [ -z "$DEV_SERVER_IP" ]; then
        echo -e "${RED}❌ No IP address provided. Using automatic detection in app.${NC}"
        DEV_SERVER_IP=""
    fi
fi

if [ -n "$DEV_SERVER_IP" ]; then
    echo -e "${GREEN}✅ Using development server IP: $DEV_SERVER_IP${NC}"
else
    echo -e "${YELLOW}⚠️  Will use automatic detection in the app${NC}"
fi

# Change to Android project directory
cd "android"

echo -e "${GREEN}🔨 Building Android app...${NC}"

# Build the debug APK with the detected IP
if [ -n "$DEV_SERVER_IP" ]; then
    ./gradlew assembleDebug -PDEV_SERVER_HOST="$DEV_SERVER_IP"
else
    ./gradlew assembleDebug
fi

echo -e "${GREEN}✅ Build complete!${NC}"
echo -e "${GREEN}📱 APK location: android/app/build/outputs/apk/debug/app-debug.apk${NC}"

# Optionally install the APK if device is connected
if command -v adb &> /dev/null; then
    if adb devices | grep -q "device$"; then
        echo -e "${YELLOW}📱 Android device detected. Install APK? (y/n):${NC}"
        read -p "" install_choice
        if [[ $install_choice == "y" || $install_choice == "Y" ]]; then
            echo -e "${GREEN}📲 Installing APK...${NC}"
            adb install -r app/build/outputs/apk/debug/app-debug.apk
            echo -e "${GREEN}✅ APK installed successfully!${NC}"
        fi
    else
        echo -e "${YELLOW}📱 No Android device connected via ADB${NC}"
    fi
fi

if [ -n "$DEV_SERVER_IP" ]; then
    echo -e "${GREEN}🚀 Start your development server with:${NC}"
    echo -e "${GREEN}   cd project && npm run dev${NC}"
    echo -e "${GREEN}🌐 Server should be accessible at: http://$DEV_SERVER_IP:3000${NC}"
fi