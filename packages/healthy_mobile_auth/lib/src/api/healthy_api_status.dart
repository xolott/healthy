import 'dart:convert';

import 'package:http/http.dart' as http;

/// Typed subset of `GET /status` used by mobile clients.
class HealthyPublicStatus {
  HealthyPublicStatus({required this.setupRequired});

  final bool setupRequired;

  factory HealthyPublicStatus.fromJson(Map<String, dynamic> json) {
    final api = json['api'];
    if (api is! Map<String, dynamic>) {
      throw const FormatException('invalid Healthy status: api');
    }
    if (api['name'] != 'healthy-api') {
      throw const FormatException('invalid Healthy status: api.name');
    }
    final sr = json['setupRequired'];
    if (sr is! bool) {
      throw const FormatException('invalid Healthy status: setupRequired');
    }
    return HealthyPublicStatus(setupRequired: sr);
  }

  static Map<String, dynamic> decodeBody(String body) {
    final decoded = jsonDecode(body);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('invalid Healthy status: root');
    }
    return decoded;
  }
}

Future<HealthyPublicStatus> fetchHealthyPublicStatus(
  String apiBaseUrl, {
  http.Client? httpClient,
}) async {
  final base = apiBaseUrl.replaceAll(RegExp(r'/+$'), '');
  final uri = Uri.parse('$base/status');
  final client = httpClient ?? http.Client();
  final ownsClient = httpClient == null;
  try {
    final res = await client.get(uri);
    if (res.statusCode != 200) {
      throw HealthyStatusHttpException('HTTP ${res.statusCode}', uri: uri);
    }
    return HealthyPublicStatus.fromJson(HealthyPublicStatus.decodeBody(res.body));
  } finally {
    if (ownsClient) {
      client.close();
    }
  }
}

class HealthyStatusHttpException implements Exception {
  HealthyStatusHttpException(this.message, {this.uri});
  final String message;
  final Uri? uri;

  @override
  String toString() => 'HealthyStatusHttpException: $message';
}
