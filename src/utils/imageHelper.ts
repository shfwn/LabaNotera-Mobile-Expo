import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export async function pickImageFromGallery(): Promise<string | null> {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Izin akses galeri dibutuhkan untuk mengunggah foto QRIS.');
        return null;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      // On Web or Native, if base64 is available, create a data URI to make it persistent across storage
      if (asset.base64) {
        return `data:image/jpeg;base64,${asset.base64}`;
      }
      return asset.uri;
    }
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
}
