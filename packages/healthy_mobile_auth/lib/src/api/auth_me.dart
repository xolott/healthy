import 'dart:convert';

import 'package:http/http.dart' as http;

class AuthMeUser {
  AuthMeUser({required this.id, required this.email, required this.displayName, required this.role});
  final String id;
  final String email;
  final String displayName;
  final String role;
}

Future<AuthMeUser> fetchAuthMe(
  String apiBaseUrl, {
  required String bearerToken,
  http.Client? httpClient,
}) async {
  final base = apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  final uri = Uri.parse('$base/auth/me');
  final client = httpClient ?? http.Client();
  final ownsClient = httpClient == null;
  try {
    final res = await client.get(
      uri,
      headers: {'Authorization': 'Bearer $bearerToken'},
    );
    if (res.statusCode == 401) {
      throw Exception('unauthorized');
    }
    if (res.statusCode != 200) {
      throw Exception('HTTP ${res.statusCode}');
    }
    final body = jsonDecode(res.body);
    if (body is! Map<String, dynamic>) {
      throw const FormatException('auth me');
    }
    final u = body['user'];
    if (u is! Map<String, dynamic>) {
      throw const FormatException('auth me user');
    }
    return AuthMeUser(
      id: u['id']! as String,
      email: u['email']! as String,
      displayName: u['displayName']! as String,
      role: u['role']! as String,
    );
  } finally {
    if (ownsClient) {
      client.close();
    }
  }
}
