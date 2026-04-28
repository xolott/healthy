import 'dart:convert';

import 'package:http/http.dart' as http;

import 'first_owner_setup.dart';

class LoginInvalidCredentialsException implements Exception {
  @override
  String toString() => 'LoginInvalidCredentialsException';
}

Future<FirstOwnerSuccess> postOwnerLogin(
  String apiBaseUrl, {
  required String email,
  required String password,
  http.Client? httpClient,
}) async {
  final base = apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  final uri = Uri.parse('$base/auth/login');
  final client = httpClient ?? http.Client();
  final ownsClient = httpClient == null;
  try {
    final res = await client.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'password': password,
      }),
    );
    if (res.statusCode == 400) {
      throw Exception('bad request');
    }
    if (res.statusCode == 401) {
      throw LoginInvalidCredentialsException();
    }
    if (res.statusCode != 200) {
      throw Exception('HTTP ${res.statusCode}');
    }
    final body = jsonDecode(res.body);
    if (body is! Map<String, dynamic>) {
      throw const FormatException('login response');
    }
    final u = body['user'];
    final s = body['session'];
    if (u is! Map || s is! Map) {
      throw const FormatException('login response');
    }
    final token = s['token'];
    final exp = s['expiresAt'];
    if (token is! String || exp is! String) {
      throw const FormatException('login session');
    }
    return FirstOwnerSuccess(user: Map<String, dynamic>.from(u), sessionToken: token, expiresAtIso: exp);
  } finally {
    if (ownsClient) {
      client.close();
    }
  }
}
