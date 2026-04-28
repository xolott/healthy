import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kKey = 'healthy_session_token';

final FlutterSecureStorage _secure = FlutterSecureStorage(
  aOptions: const AndroidOptions(encryptedSharedPreferences: true),
);

Future<void> _migrateStringFromPrefs(String key) async {
  final cur = await _secure.read(key: key);
  if (cur != null && cur.isNotEmpty) return;
  final p = await SharedPreferences.getInstance();
  final old = p.getString(key);
  if (old != null && old.isNotEmpty) {
    await _secure.write(key: key, value: old);
    await p.remove(key);
  }
}

Future<String?> readSessionToken() async {
  await _migrateStringFromPrefs(_kKey);
  return _secure.read(key: _kKey);
}

Future<void> writeSessionToken(String token) async {
  final p = await SharedPreferences.getInstance();
  await p.remove(_kKey);
  await _secure.write(key: _kKey, value: token);
}

Future<void> clearSessionToken() async {
  final p = await SharedPreferences.getInstance();
  await p.remove(_kKey);
  await _secure.delete(key: _kKey);
}
