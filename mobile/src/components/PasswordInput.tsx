import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props extends Omit<TextInputProps, 'secureTextEntry' | 'style'> {
  /** Style applied to the inner TextInput — pass the same style used for other fields on the screen. */
  inputStyle?: StyleProp<any>;
  /** Style applied to the wrapping row (useful when the screen doesn't already give the input a bordered container). */
  containerStyle?: StyleProp<ViewStyle>;
  iconColor?: string;
}

/**
 * A password TextInput with a "show/hide" eye toggle. Testers repeatedly
 * flagged that there was no way to confirm what had actually been typed
 * into a password field, so this is a drop-in replacement for a plain
 * `<TextInput secureTextEntry />` that adds that toggle everywhere it's used.
 */
const PasswordInput: React.FC<Props> = ({ inputStyle, containerStyle, iconColor = '#9CA3AF', ...rest }) => {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.row, containerStyle]}>
      <TextInput
        style={[inputStyle, styles.input]}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <MaterialCommunityIcons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={iconColor} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1 },
  toggle: { paddingLeft: 10 },
});

export default PasswordInput;
