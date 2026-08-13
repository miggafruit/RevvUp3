import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { showAlert } from '../utils/crossPlatformAlert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { RootStackParamList } from '../types/navigation';
import { getProductById, createProduct, updateProduct } from '../api/productApi';
import { Spec } from '../types/marketplace';
import SpecsEditor from '../components/SpecsEditor';
import ImagePickerField from '../components/ImagePickerField';
import { colors, spacing, radius, typography } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'ProductForm'>;

const CONDITIONS: Array<'Brand New' | 'Used' | 'Refurbished'> = ['Brand New', 'Used', 'Refurbished'];

const ProductFormScreen: React.FC<Props> = ({ navigation, route }) => {
  const productId = route.params?.productId;
  const isEditing = !!productId;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [stock, setStock] = useState('');
  const [condition, setCondition] = useState<'Brand New' | 'Used' | 'Refurbished'>('Brand New');
  const [deliveryEstimate, setDeliveryEstimate] = useState('3-5 business days');
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [images, setImages] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(isEditing);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!productId) return;
    getProductById(productId)
      .then((product) => {
        setName(product.name);
        setPrice(String(product.price));
        setCategory(product.category);
        setDescription(product.description);
        setStock(String(product.stock));
        setCondition(product.condition);
        setDeliveryEstimate(product.deliveryEstimate);
        setSpecs(product.specs || []);
        setImages(product.images || []);
      })
      .catch((error) => {
        console.warn('Failed to load product for editing', error);
        showAlert('Error', 'Could not load this product for editing');
      })
      .finally(() => setIsLoading(false));
  }, [productId]);

  const validate = (): string | null => {
    if (!name.trim()) return 'Please enter a product name';
    if (!price.trim() || isNaN(Number(price)) || Number(price) < 0) return 'Please enter a valid price';
    if (!category.trim()) return 'Please enter a category';
    if (!description.trim()) return 'Please enter a description';
    if (!stock.trim() || isNaN(Number(stock)) || Number(stock) < 0) return 'Please enter a valid stock count';
    const incompleteSpec = specs.some((s) => !s.key.trim() || !s.value.trim());
    if (incompleteSpec) return 'Please fill in or remove incomplete specification rows';
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validate();
    if (validationError) {
      showAlert('Missing Information', validationError);
      return;
    }

    const payload = {
      name: name.trim(),
      price: Number(price),
      category: category.trim(),
      description: description.trim(),
      stock: Number(stock),
      condition,
      deliveryEstimate: deliveryEstimate.trim(),
      specs,
      images
    };

    setIsSubmitting(true);
    try {
      if (isEditing && productId) {
        await updateProduct(productId, payload);
      } else {
        await createProduct(payload);
      }
      navigation.goBack();
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Something went wrong saving this product';
      showAlert('Save Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditing ? 'Edit Product' : 'New Product'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Product Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Basic Engine"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Price (R)</Text>
          <TextInput
            style={styles.input}
            value={price}
            onChangeText={setPrice}
            placeholder="e.g. 2500"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Category</Text>
          <TextInput
            style={styles.input}
            value={category}
            onChangeText={setCategory}
            placeholder="e.g. Body, Oil, Tires, Exhaust"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the product, what it's compatible with, condition, etc."
            placeholderTextColor={colors.textMuted}
            multiline
          />

          <Text style={styles.label}>Stock Count</Text>
          <TextInput
            style={styles.input}
            value={stock}
            onChangeText={setStock}
            placeholder="e.g. 10"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />

          <Text style={styles.label}>Condition</Text>
          <View style={styles.pillRow}>
            {CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.pill, condition === c && styles.pillActive]}
                onPress={() => setCondition(c)}
              >
                <Text style={[styles.pillText, condition === c && styles.pillTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Delivery Estimate</Text>
          <TextInput
            style={styles.input}
            value={deliveryEstimate}
            onChangeText={setDeliveryEstimate}
            placeholder="e.g. 3-5 business days"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={styles.label}>Specifications</Text>
          <SpecsEditor specs={specs} onChange={setSpecs} />

          <Text style={styles.label}>Photos</Text>
          <ImagePickerField images={images} onChange={setImages} />

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>{isEditing ? 'Save Changes' : 'Post Product'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md
  },
  backArrow: { color: colors.textPrimary, fontSize: 20 },
  headerTitle: { ...typography.cardTitle, fontSize: 17, color: colors.textPrimary },
  scrollContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary
  },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },
  pillRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border
  },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '600' },
  pillTextActive: { color: colors.white },
  submitButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 }
});

export default ProductFormScreen;
