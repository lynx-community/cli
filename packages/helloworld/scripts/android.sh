#!/bin/bash

# android.sh - Build Android app with automatic dev server IP detection

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔍 Detecting development server IP address...${NC}"

# --- Ensure Android SDK tools are available in PATH temporarily ---------------------------------
# If `emulator` or `adb` are not on PATH, try to locate common Android SDK locations and
# temporarily add emulator and platform-tools to PATH for this script's lifetime.
ensure_android_tools_on_path() {
    if command -v emulator >/dev/null 2>&1 && command -v adb >/dev/null 2>&1; then
        return 0
    fi

    # Candidate SDK roots to check
    CANDIDATES=("${ANDROID_SDK_ROOT:-}" "${ANDROID_HOME:-}" "$HOME/Android/Sdk" "/usr/lib/android-sdk")
    for C in "${CANDIDATES[@]}"; do
        [ -z "$C" ] && continue
        EMU_DIR="$C/emulator"
        PLAT_DIR="$C/platform-tools"
        if [ -d "$EMU_DIR" ] || [ -d "$PLAT_DIR" ]; then
            export PATH="$EMU_DIR:$PLAT_DIR:$PATH"
            break
        fi
    done

    # Last attempt: look for 'emulator' binary under common locations
    if ! command -v emulator >/dev/null 2>&1; then
        for DIR in "$HOME/Android/Sdk/emulator" "/opt/android/emulator" "/usr/lib/android-sdk/emulator"; do
            [ -x "$DIR/emulator" ] && export PATH="$DIR:$PATH" && break
        done
    fi

    # If still not found, warn (we may still continue if adb exists)
    if ! command -v emulator >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  'emulator' not found on PATH. Emulator-related features may not work.${NC}"
    fi
    if ! command -v adb >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  'adb' not found on PATH. Device detection/install will fail.${NC}"
    fi
}

ensure_android_tools_on_path

# Helper to choose an AVD from a newline-separated list.
# Usage: chosen=$(choose_avd "$AVD_LIST")
choose_avd() {
    local avd_list="$1"
    if [ -z "$avd_list" ]; then
        echo "";
        return
    fi
    # Read into array
    mapfile -t avds <<< "$avd_list"
    if [ ${#avds[@]} -eq 1 ]; then
        echo "${avds[0]}"
        return
    fi

    echo -e "${GREEN}📱 Available emulators:${NC}"
    for i in "${!avds[@]}"; do
        idx=$((i+1))
        printf "%2d) %s\n" "$idx" "${avds[i]}"
    done

    # Respect environment override or first script arg
    if [ -n "$AVD_NAME" ]; then
        echo "$AVD_NAME"
        return
    fi
    if [ -n "$1" ] && [ -n "$2" ]; then
        # nothing
        :
    fi
    if [ -n "$1" ] && [ -z "$AVD_NAME" ]; then
        # if caller mistakenly passed choose_avd extra args, ignore
        :
    fi

    read -p "👉 Select emulator by number or name: " sel
    if [[ "$sel" =~ ^[0-9]+$ ]]; then
        sel_index=$((sel-1))
        if [ $sel_index -ge 0 ] && [ $sel_index -lt ${#avds[@]} ]; then
            echo "${avds[$sel_index]}"
            return
        else
            echo ""
            return
        fi
    else
        # assume name
        echo "$sel"
        return
    fi
}


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

# 1. List connected devices and running emulators
if ! command -v adb >/dev/null 2>&1; then
    echo -e "${RED}❌ 'adb' not found. Please install Android Platform Tools or ensure ANDROID_HOME/ANDROID_SDK_ROOT is set.${NC}"
    exit 1
fi

# All connected device serials (including emulator-*)
ALL_DEVICES=$(adb devices | awk 'NR>1 && $2=="device" {print $1}')

# Separate physical devices and running emulators
PHYSICAL_DEVICES=$(echo "$ALL_DEVICES" | grep -v '^emulator-' || true)
RUNNING_EMULATORS=$(echo "$ALL_DEVICES" | grep '^emulator-' || true)

if [ -z "$PHYSICAL_DEVICES" ] && [ -z "$RUNNING_EMULATORS" ]; then
    echo -e "${YELLOW}⚠️ No connected physical devices or running emulators detected.${NC}"
    # Offer to boot an AVD
    if ! command -v emulator >/dev/null 2>&1; then
        echo -e "${RED}❌ 'emulator' not found. Cannot list or boot AVDs.${NC}"
        echo -e "${YELLOW}Ensure Android SDK emulator is installed and ANDROID_SDK_ROOT/ANDROID_HOME is set.${NC}"
        exit 1
    fi

    AVD_LIST=$(emulator -list-avds)
    if [ -z "$AVD_LIST" ]; then
        echo -e "${RED}❌ No Android emulators found.${NC}"
        echo -e "${YELLOW}Create one using Android Studio's AVD Manager.${NC}"
        exit 1
    fi

    echo -e "${GREEN}📱 Available emulators:${NC}"
    echo "$AVD_LIST"
    AVD_NAME=$(choose_avd "$AVD_LIST")
    if [ -z "$AVD_NAME" ]; then
        echo -e "${RED}❌ No AVD selected.${NC}"
        exit 1
    fi

    echo -e "${GREEN}🚀 Booting emulator $AVD_NAME...${NC}"
    # Create a temp log so we can diagnose crashes
    EMU_LOG=$(mktemp /tmp/emulator-${AVD_NAME}.XXXX.log)
    nohup emulator -avd "$AVD_NAME" >"$EMU_LOG" 2>&1 &

    echo -e "${YELLOW}⏳ Waiting for emulator to appear (serial)...${NC}"
    # Wait for emulator serial to appear
    EMU_SERIAL=""
    for i in {1..30}; do
        sleep 1
        EMU_SERIAL=$(adb devices | awk 'NR>1 && $2=="device" {print $1}' | grep '^emulator-' | head -n1 || true)
        if [ -n "$EMU_SERIAL" ]; then
            break
        fi
    done

    if [ -z "$EMU_SERIAL" ]; then
        echo -e "${RED}❌ Could not determine emulator serial after boot. Emulator may have crashed.${NC}"
        echo -e "${YELLOW}Recent emulator log (last 50 lines):${NC}"
        tail -n 50 "$EMU_LOG" || true
        echo -e "${YELLOW}adb devices:${NC}"
        adb devices || true
        exit 1
    fi

    echo -e "${YELLOW}⏳ Waiting for emulator to finish booting (sys.boot_completed)...${NC}"
    BOOT_COMPLETED=""
    # Wait up to 180 seconds for boot
    for i in {1..90}; do
        BOOT_COMPLETED=$(adb -s "$EMU_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
        if [ "$BOOT_COMPLETED" == "1" ]; then
            break
        fi
        sleep 2
    done

    if [ "$BOOT_COMPLETED" != "1" ]; then
        echo -e "${RED}❌ Emulator failed to finish boot within timeout.${NC}"
        echo -e "${YELLOW}Recent emulator log (last 100 lines):${NC}"
        tail -n 100 "$EMU_LOG" || true
        echo -e "${YELLOW}adb devices:${NC}"
        adb devices || true
        exit 1
    fi

    echo -e "${GREEN}✅ Emulator $EMU_SERIAL booted successfully.${NC}"
    # Refresh running emulators list
    RUNNING_EMULATORS=$(adb devices | awk 'NR>1 && $2=="device" {print $1}' | grep '^emulator-' || true)
fi

# Ask user where to install (if physical devices exist, allow choice)
if [ -n "$PHYSICAL_DEVICES" ]; then
    echo -e "${YELLOW}Detected physical device(s):${NC}"
    echo "$PHYSICAL_DEVICES"
    read -p "👉 Install on physical device (p) or emulator (e)? " target
else
    # No physical device, prefer emulator
    target="e"
fi

APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
    echo -e "${RED}❌ APK not found at $APK_PATH${NC}"
    exit 1
fi

if [[ "$target" == "p" ]]; then
    # If multiple physical devices, ask which one
    if [ $(echo "$PHYSICAL_DEVICES" | wc -l) -gt 1 ]; then
        echo -e "${YELLOW}Multiple physical devices detected:${NC}"
        echo "$PHYSICAL_DEVICES"
        read -p "👉 Enter device serial to install (or 'all'): " chosen
        if [[ "$chosen" == "all" ]]; then
            for s in $PHYSICAL_DEVICES; do
                echo -e "${GREEN}📲 Installing to $s...${NC}"
                adb -s "$s" install -r "$APK_PATH"
            done
        else
            adb -s "$chosen" install -r "$APK_PATH"
        fi
    else
        # single physical device
        target_serial=$(echo "$PHYSICAL_DEVICES" | tr -d '\n')
        echo -e "${GREEN}📲 Installing to $target_serial...${NC}"
        adb -s "$target_serial" install -r "$APK_PATH"
    fi
else
    # Install on emulator: if no running emulator, allow booting an AVD
    if [ -z "$RUNNING_EMULATORS" ]; then
        if ! command -v emulator >/dev/null 2>&1; then
            echo -e "${RED}❌ 'emulator' not found. Cannot boot AVD.${NC}"
            exit 1
        fi
        AVD_LIST=$(emulator -list-avds)
        if [ -z "$AVD_LIST" ]; then
            echo -e "${RED}❌ No Android emulators found.${NC}"
            exit 1
        fi
        echo -e "${GREEN}📱 Available emulators:${NC}"
        echo "$AVD_LIST"
        AVD_NAME=$(choose_avd "$AVD_LIST")
        if [ -z "$AVD_NAME" ]; then
            echo -e "${RED}❌ No AVD selected.${NC}"
            exit 1
        fi
        echo -e "${GREEN}🚀 Booting emulator $AVD_NAME...${NC}"
        EMU_LOG=$(mktemp /tmp/emulator-${AVD_NAME}.XXXX.log)
        nohup emulator -avd "$AVD_NAME" >"$EMU_LOG" 2>&1 &

        echo -e "${YELLOW}⏳ Waiting for emulator to appear (serial)...${NC}"
        EMU_SERIAL=""
        for i in {1..30}; do
            sleep 1
            EMU_SERIAL=$(adb devices | awk 'NR>1 && $2=="device" {print $1}' | grep '^emulator-' | head -n1 || true)
            if [ -n "$EMU_SERIAL" ]; then
                break
            fi
        done

        if [ -z "$EMU_SERIAL" ]; then
            echo -e "${RED}❌ Could not determine emulator serial after boot. Emulator may have crashed.${NC}"
            echo -e "${YELLOW}Recent emulator log (last 50 lines):${NC}"
            tail -n 50 "$EMU_LOG" || true
            echo -e "${YELLOW}adb devices:${NC}"
            adb devices || true
            exit 1
        fi

        echo -e "${YELLOW}⏳ Waiting for emulator to finish booting (sys.boot_completed)...${NC}"
        BOOT_COMPLETED=""
        for i in {1..90}; do
            BOOT_COMPLETED=$(adb -s "$EMU_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)
            if [ "$BOOT_COMPLETED" == "1" ]; then
                break
            fi
            sleep 2
        done

        if [ "$BOOT_COMPLETED" != "1" ]; then
            echo -e "${RED}❌ Emulator failed to finish boot within timeout.${NC}"
            echo -e "${YELLOW}Recent emulator log (last 100 lines):${NC}"
            tail -n 100 "$EMU_LOG" || true
            echo -e "${YELLOW}adb devices:${NC}"
            adb devices || true
            exit 1
        fi

        echo -e "${GREEN}✅ Emulator $EMU_SERIAL booted successfully.${NC}"
        RUNNING_EMULATORS=$(adb devices | awk 'NR>1 && $2=="device" {print $1}' | grep '^emulator-' || true)
    fi

    # Use first running emulator
    EMU_SERIAL=$(echo "$RUNNING_EMULATORS" | head -n1 | tr -d '\n')
    if [ -z "$EMU_SERIAL" ]; then
        echo -e "${RED}❌ Could not determine emulator serial.${NC}"
        exit 1
    fi
    echo -e "${GREEN}📲 Installing to emulator $EMU_SERIAL...${NC}"
    adb -s "$EMU_SERIAL" install -r "$APK_PATH"
fi

echo -e "${GREEN}✅ APK installed successfully.${NC}"

if [ -n "$DEV_SERVER_IP" ]; then
    echo -e "${GREEN}🚀 Start your development server with:${NC}"
    echo -e "${GREEN}   cd project && npm run dev${NC}"
    echo -e "${GREEN}🌐 Server should be accessible at: http://$DEV_SERVER_IP:3000${NC}"
fi