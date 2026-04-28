import 'package:shared_preferences/shared_preferences.dart';

/// Persists the configured Healthy API base URL for this app install.
abstract final class ApiBaseUrlStore {
  static const _key = 'healthy_api_base_url';

  static Future<String?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final v = prefs.getString(_key);
    if (v == null || v.trim().isEmpty) {
      return null;
    }
    return v.trim().replaceAll(RegExp(r'/+$'), '');
  }

  static Future<void> write(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, url.trim().replaceAll(RegExp(r'/+$'), ''));
  }
}
