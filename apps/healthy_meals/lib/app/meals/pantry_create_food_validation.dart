/// Shared client-side checks before posting a new Pantry food (mobile).
String? validatePantryCreateFoodForm({
  required String name,
  required String baseAmountRaw,
  required String caloriesRaw,
  required String proteinRaw,
  required String fatRaw,
  required String carbohydratesRaw,
  required String iconKey,
}) {
  if (name.trim().isEmpty) {
    return 'Name is required.';
  }
  if (iconKey.trim().isEmpty) {
    return 'Choose an icon.';
  }
  final baseT = baseAmountRaw.trim();
  if (baseT.isEmpty) {
    return 'Base amount is required.';
  }
  final baseN = num.tryParse(baseT);
  if (baseN == null || !baseN.isFinite || baseN <= 0) {
    return 'Base amount must be a positive number.';
  }
  for (final entry in <(String, String)>[
    (caloriesRaw, 'Calories'),
    (proteinRaw, 'Protein'),
    (fatRaw, 'Fat'),
    (carbohydratesRaw, 'Carbohydrates'),
  ]) {
    final msg = _nonNegativeNumberMessage(entry.$1, entry.$2);
    if (msg != null) {
      return msg;
    }
  }
  return null;
}

String? _nonNegativeNumberMessage(String raw, String label) {
  final t = raw.trim();
  if (t.isEmpty) {
    return '$label is required.';
  }
  final n = num.tryParse(t);
  if (n == null || !n.isFinite) {
    return '$label must be a number.';
  }
  if (n < 0) {
    return '$label cannot be negative.';
  }
  return null;
}
