// Pure helpers for Pantry catalog search and Food row fields from list API metadata.

bool pantrySearchMatches(String query, {required String name, String? brand}) {
  final q = query.trim().toLowerCase();
  if (q.isEmpty) {
    return true;
  }
  if (name.toLowerCase().contains(q)) {
    return true;
  }
  if (brand != null && brand.toLowerCase().contains(q)) {
    return true;
  }
  return false;
}

String? pantryBrandFromMetadata(Map<String, dynamic>? metadata) {
  if (metadata == null) {
    return null;
  }
  final b = metadata['brand'];
  if (b is String && b.trim().isNotEmpty) {
    return b.trim();
  }
  return null;
}

double? foodListCaloriesFromMetadata(Map<String, dynamic>? metadata) {
  if (metadata == null) {
    return null;
  }
  if (metadata['kind'] != 'food') {
    return null;
  }
  final nutrients = metadata['nutrients'];
  if (nutrients is! Map<String, dynamic>) {
    return null;
  }
  final cal = nutrients['calories'];
  if (cal is num) {
    return cal.toDouble();
  }
  return null;
}
