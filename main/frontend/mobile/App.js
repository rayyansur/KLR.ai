import React from 'react';
import { SafeAreaView, StatusBar } from 'react-native';
import MainApp from './src/components/MainApp';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar barStyle="light-content" />
      <MainApp />
    </SafeAreaView>
  );
}

