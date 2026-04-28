import 'package:shared_preferences/shared_preferences.dart';

const _kKey = 'healthy_session_token';

Future<String?> readSessionToken() async {
  final p = await SharedPreferences.getInstance();
  return p.getString(_kKey);
}

Future<void> writeSessionToken(String token) async {
  final p = await SharedPreferences.getInstance();
  await p.setString(_kKey, token);
}

Future<void> clearSessionToken() async {
  final p = await SharedPreferences.getInstance();
  await p.remove(_kKey);
}
