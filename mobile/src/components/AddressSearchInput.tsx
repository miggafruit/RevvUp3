import React, { useRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { searchPlaces, getPlaceDetails, PlacePrediction, PlaceDetails } from '../api/locationApi';

interface AddressSearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectPlace: (details: PlaceDetails) => void;
  placeholder?: string;
  near?: { latitude: number; longitude: number };
  onError?: () => void;
  /** Overrides individual theme colors — for a screen with its own
   * theme file whose exact colors differ slightly from the default
   * below (e.g. checkout/registration screens each have their own
   * theme file with slightly different exact hex values). */
  colorOverrides?: Partial<typeof DEFAULT_THEME>;
}

// The whole app shares one dark theme now — this is just the default,
// overridable per-screen via colorOverrides above for pixel-exact
// matching against a screen's own theme file.
const DEFAULT_THEME = {
  inputBg: '#17171C',
  border: '#2A2A32',
  text: '#FFFFFF',
  placeholder: '#6B7280',
  icon: '#F97316',
  predictionSecondary: '#9CA3AF',
};

/**
 * Debounced Places Autocomplete input — the same behavior originally
 * built for EHailingClientScreen, extracted here so every address
 * field in the app (checkout, business registration, etc.) shares one
 * implementation instead of three copies quietly drifting apart.
 */
const AddressSearchInput: React.FC<AddressSearchInputProps> = ({
  value,
  onChangeText,
  onSelectPlace,
  placeholder = 'Search for a street address, suburb, city...',
  near,
  onError,
  colorOverrides,
}) => {
  const theme = { ...DEFAULT_THEME, ...colorOverrides };
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleChangeText = (text: string) => {
    onChangeText(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchError(null);
    if (text.trim().length < 3) {
      setPredictions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchPlaces(text, near);
        setPredictions(results);
        if (results.length === 0) {
          setSearchError(null); // genuinely zero matches — not an error, don't show a false alarm
        }
      } catch (err: any) {
        setPredictions([]);
        // Surfaced deliberately — this used to be a silent catch that
        // made "the API key is wrong" and "there's genuinely nothing
        // here" look identical, with no way to tell them apart.
        setSearchError(
          err?.response?.data?.message ||
            (err?.message === 'Network Error'
              ? "Can't reach the server — check your connection."
              : 'Search failed. Please try again.')
        );
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleSelectPrediction = async (prediction: PlacePrediction) => {
    setPredictions([]);
    setIsResolving(true);
    try {
      const details = await getPlaceDetails(prediction.placeId);
      onSelectPlace(details);
    } catch {
      onError?.();
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <View>
      <View style={[styles.inputRow, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
        <MaterialCommunityIcons name="map-marker" size={20} color={theme.icon} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.placeholder}
          value={value}
          onChangeText={handleChangeText}
        />
        {(isSearching || isResolving) && <ActivityIndicator size="small" color={theme.icon} />}
      </View>

      {searchError && (
        <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>{searchError}</Text>
      )}

      {predictions.length > 0 && (
        <View style={[styles.predictionsBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          {predictions.map((prediction) => (
            <TouchableOpacity
              key={prediction.placeId}
              style={[styles.predictionRow, { borderBottomColor: theme.border }]}
              onPress={() => handleSelectPrediction(prediction)}
            >
              <MaterialCommunityIcons name="map-marker-outline" size={16} color={theme.predictionSecondary} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[styles.predictionMain, { color: theme.text }]} numberOfLines={1}>
                  {prediction.mainText ?? prediction.description}
                </Text>
                {prediction.secondaryText ? (
                  <Text style={[styles.predictionSecondary, { color: theme.predictionSecondary }]} numberOfLines={1}>
                    {prediction.secondaryText}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 12,
  },
  predictionsBox: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 6,
    overflow: 'hidden',
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  predictionMain: { fontSize: 14, fontWeight: '500' },
  predictionSecondary: { fontSize: 12, marginTop: 2 },
});

export default AddressSearchInput;
