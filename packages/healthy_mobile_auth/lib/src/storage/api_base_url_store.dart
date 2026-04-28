import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persists the configured Healthy API base URL for this app install (keychain / keystore).
abstract final class ApiBaseUrlStore {
  static const _key = 'healthy_api_base_url';

  static final FlutterSecureStorage _secure = FlutterSecureStorage(
    aOptions: const AndroidOptions(encryptedSharedPreferences: true),
  );

  static Future<void> _migrateFromPrefs() async {
    final cur = await _secure.read(key: _key);
    if (cur != null && cur.isNotEmpty) return;
    final p = await SharedPreferences.getInstance();
    final old = p.getString(_key);
    if (old != null && old.isNotEmpty) {
      await _secure.write(key: _key, value: old.trim().replaceAll(RegExp(r'/+$'), ''));
      await p.remove(_key);
    }
  }

  static Future<String?> read() async {
    await _migrateFromPrefs();
    final v = await _secure.read(key: _key);
    if (v == null || v.trim().isEmpty) {
      return null;
    }
    return v.trim().replaceAll(RegExp(r'/+$'), '');
  }

  static Future<void> write(String url) async {
    final p = await SharedPreferences.getInstance();
    await p.remove(_key);
    final normalized = url.trim().replaceAll(RegExp(r'/+$'), '');
    await _secure.write(key: _key, value: normalized);
  }
}
