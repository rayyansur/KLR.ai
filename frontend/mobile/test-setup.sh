#!/bin/bash

# Frontend Test Setup Script
# This script helps verify all prerequisites before testing

echo "🔍 Checking Frontend Test Prerequisites..."
echo ""

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Must run from main/frontend/mobile directory"
    exit 1
fi

echo "✅ In correct directory"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js"
    exit 1
fi
echo "✅ Node.js installed: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✅ npm installed: $(npm --version)"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Run: npm install"
else
    echo "✅ node_modules exists"
fi

# Check Android setup
if [ -d "android" ]; then
    echo "✅ Android directory exists"
    
    # Check MiDaS model
    if [ -f "android/app/src/main/assets/midas_v3.1_small.tflite" ]; then
        echo "✅ MiDaS model found"
    else
        echo "⚠️  MiDaS model NOT found at: android/app/src/main/assets/midas_v3.1_small.tflite"
        echo "   You need to add the model file for depth estimation to work"
    fi
    
    # Check native bridge files
    BRIDGE_FILES=(
        "android/app/src/main/java/com/app/MLKitBridge.java"
        "android/app/src/main/java/com/app/DepthModelBridge.java"
        "android/app/src/main/java/com/app/CollisionDetectorBridge.java"
        "android/app/src/main/java/com/app/RelativeCollisionDetector.java"
        "android/app/src/main/java/com/app/MLKitBridgePackage.java"
    )
    
    echo ""
    echo "Checking native bridge files:"
    for file in "${BRIDGE_FILES[@]}"; do
        if [ -f "$file" ]; then
            echo "✅ $(basename $file)"
        else
            echo "❌ Missing: $(basename $file)"
        fi
    done
else
    echo "⚠️  Android directory not found"
fi

# Check backend
echo ""
echo "Checking backend connection..."
if curl -s http://localhost:5000/health > /dev/null 2>&1; then
    echo "✅ Backend is running on http://localhost:5000"
else
    echo "⚠️  Backend NOT running on http://localhost:5000"
    echo "   Start it with: cd ../../backend && python main.py"
fi

# Check for device IP (for physical device testing)
echo ""
echo "📱 For physical device testing:"
echo "   Update BackendService.js with your computer's IP address"
echo "   Find IP: ifconfig | grep 'inet ' (Mac/Linux)"
echo "   Or: ipconfig (Windows)"

echo ""
echo "✅ Prerequisites check complete!"
echo ""
echo "Next steps:"
echo "1. Install dependencies: npm install"
echo "2. Start backend: cd ../../backend && python main.py"
echo "3. Run app: npm run android (or npm run ios)"
echo "4. Follow TESTING_GUIDE.md for detailed testing steps"

