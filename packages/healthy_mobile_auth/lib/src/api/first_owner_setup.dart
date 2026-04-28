import 'dart:convert';

import 'package:http/http.dart' as http;

const kPasswordMinLength = 12;

class FirstOwnerSuccess {
  FirstOwnerSuccess({required this.user, required this.sessionToken, required this.expiresAtIso});
  final Map<String, dynamic> user;
  final String sessionToken;
  final String expiresAtIso;
}

class PasswordPolicyException implements Exception {
  PasswordPolicyException(this.message, {required this.minLength});
  final String message;
  final int minLength;
  @override
  String toString() => 'PasswordPolicyException: $message';
}

class SetupNotAvailableException implements Exception {
  @override
  String toString() => 'SetupNotAvailableException';
}

Future<FirstOwnerSuccess> postFirstOwnerSetup(
  String apiBaseUrl, {
  required String displayName,
  required String email,
  required String password,
  http.Client? httpClient,
}) async {
  final base = apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  final uri = Uri.parse('$base/setup/first-owner');
  final client = httpClient ?? http.Client();
  final ownsClient = httpClient == null;
  try {
    final res = await client.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'displayName': displayName,
        'email': email,
        'password': password,
      }),
    );
    if (res.statusCode == 400) {
      final m = jsonDecode(res.body);
      if (m is Map && m['error'] == 'password_policy' && m['minLength'] is int && m['message'] is String) {
        throw PasswordPolicyException(m['message'] as String, minLength: m['minLength'] as int);
      }
      throw Exception('bad request');
    }
    if (res.statusCode == 404) {
      throw SetupNotAvailableException();
    }
    if (res.statusCode != 201) {
      throw Exception('HTTP ${res.statusCode}');
    }
    final body = jsonDecode(res.body);
    if (body is! Map<String, dynamic>) {
      throw const FormatException('setup response');
    }
    final u = body['user'];
    final s = body['session'];
    if (u is! Map || s is! Map) {
      throw const FormatException('setup response');
    }
    final token = s['token'];
    final exp = s['expiresAt'];
    if (token is! String || exp is! String) {
      throw const FormatException('setup session');
    }
    return FirstOwnerSuccess(user: Map<String, dynamic>.from(u), sessionToken: token, expiresAtIso: exp);
  } finally {
    if (ownsClient) {
      client.close();
    }
  }
}
