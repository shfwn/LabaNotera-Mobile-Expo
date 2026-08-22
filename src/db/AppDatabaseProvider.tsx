import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, View, ActivityIndicator, Text } from 'react-native';
import { SQLiteProvider, SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from './index';
import { webSQLiteDatabase } from './webDb';
import { Colors } from '../constants/theme';

const WebDBContext = createContext<SQLiteDatabase | null>(null);

export function useAppSQLiteContext(): SQLiteDatabase {
  if (Platform.OS === 'web') {
    const db = useContext(WebDBContext);
    return db || webSQLiteDatabase;
  }
  // On Native, use standard expo-sqlite context
  const { useSQLiteContext } = require('expo-sqlite');
  return useSQLiteContext();
}

export function AppSQLiteProvider({ children }: { children: React.ReactNode }) {
  const [isWebInitialized, setIsWebInitialized] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      initDatabase(webSQLiteDatabase)
        .then(() => setIsWebInitialized(true))
        .catch((err) => {
          console.error('Web DB Init Error:', err);
          setIsWebInitialized(true);
        });
    }
  }, []);

  if (Platform.OS === 'web') {
    if (!isWebInitialized) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={{ marginTop: 12, color: Colors.textSecondary, fontSize: 14 }}>
            Memuat Basis Data LabaNotera...
          </Text>
        </View>
      );
    }
    return (
      <WebDBContext.Provider value={webSQLiteDatabase}>
        {children}
      </WebDBContext.Provider>
    );
  }

  return (
    <SQLiteProvider databaseName="labanotera.db" onInit={initDatabase} useSuspense={false}>
      {children}
    </SQLiteProvider>
  );
}
