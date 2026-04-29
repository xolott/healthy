import 'dart:convert';

import 'package:http/http.dart' as http;

/// Shared HTTP client for Pantry screens so widget tests can inject [MockClient].
class PantryHttp {
  PantryHttp._();

  static http.Client client = http.Client();

  static Future<http.Response> get(Uri url, {Map<String, String>? headers}) {
    return client.get(url, headers: headers);
  }

  static Future<http.Response> post(
    Uri url, {
    Map<String, String>? headers,
    Object? body,
    Encoding? encoding,
  }) {
    return client.post(url, headers: headers, body: body, encoding: encoding);
  }
}
