import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectModalProps {
  visible: boolean;
  title: string;
  options: SelectOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  borderColor?: string;
  textColor?: string;
  mutedTextColor?: string;
}

/**
 * A select-one-from-a-list modal with full control over every color —
 * unlike @react-native-picker/picker, whose open dropdown is largely
 * styled by the OS (especially on Android), meaning app-controlled
 * text colors can end up unreadable against an OS-controlled
 * background the app can't reliably override.
 */
const SelectModal: React.FC<SelectModalProps> = ({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
  accentColor = '#F97316',
  backgroundColor = '#0A1628',
  surfaceColor = '#142035',
  borderColor = '#374151',
  textColor = '#FFFFFF',
  mutedTextColor = '#9CA3AF',
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheet, { backgroundColor: surfaceColor, borderColor }]}
        >
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <Text style={[styles.title, { color: textColor }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={22} color={mutedTextColor} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 400 }}>
            {options.map((option) => {
              const isSelected = option.value === selectedValue;
              return (
                <TouchableOpacity
                  key={option.value || '__empty__'}
                  style={[
                    styles.optionRow,
                    { borderBottomColor: borderColor, backgroundColor: isSelected ? backgroundColor : 'transparent' },
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <Text style={[styles.optionText, { color: isSelected ? accentColor : textColor }]}>
                    {option.label}
                  </Text>
                  {isSelected && <MaterialCommunityIcons name="check" size={20} color={accentColor} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionText: { fontSize: 15, fontWeight: '500', flex: 1 },
});

export default SelectModal;
